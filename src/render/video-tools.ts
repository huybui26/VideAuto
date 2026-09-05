import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { getDurationSec } from "../assets/audio-tools.js";

export function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let out = "", err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} failed (exit ${code}): ${err.slice(-800)}`)),
    );
    proc.on("error", reject);
  });
}

/** Common encode flags so every fitted clip is concat-compatible (same codec). */
const ENCODE = (fps: number) => [
  "-an",
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "18",
  "-pix_fmt", "yuv420p",
  "-r", String(fps),
];

/**
 * Re-encode `inPath` to exactly `targetSec` seconds (video only):
 * - longer target → freeze the last frame (tpad clone) to fill the remainder,
 *   so a 5s poster animation holds while the scene's narration continues;
 * - shorter target → trim. Output is normalized for concat.
 */
export async function fitClipToDuration(
  inPath: string,
  targetSec: number,
  outPath: string,
  fps = 30,
): Promise<void> {
  const inDur = await getDurationSec(inPath);
  const target = Math.max(0.1, targetSec);
  const args = ["-y", "-i", inPath];
  
  // Build video filter chain: always force 1080x1920 + optional tpad
  const vfParts: string[] = ["scale=1080:1920:force_original_aspect_ratio=disable"];
  if (target > inDur + 0.02) {
    const ext = target - inDur;
    vfParts.push(`tpad=stop_mode=clone:stop_duration=${ext.toFixed(3)}`);
  }
  args.push("-vf", vfParts.join(","));
  
  args.push("-t", target.toFixed(3), ...ENCODE(fps), outPath);
  await run("ffmpeg", args);
}

/** Concatenate uniformly-encoded clips into one silent video (stream copy). */
export async function concatVideos(clipPaths: string[], outPath: string): Promise<void> {
  if (clipPaths.length === 0) throw new Error("concatVideos: empty clipPaths");
  const tmp = await mkdtemp(join(tmpdir(), "vconcat-"));
  try {
    const listFile = join(tmp, "list.txt");
    // Absolute paths: the concat demuxer resolves `file '...'` relative to the
    // list file's directory (the temp dir), not the process cwd.
    const body = clipPaths
      .map((p) => `file '${resolve(p).replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listFile, body, "utf8");
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outPath]);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

/**
 * Mux an audio track onto a silent video. The video length wins (no -shortest),
 * so an outro visual hold past the end of narration is preserved as silent tail.
 */
export async function muxAudioOntoVideo(
  videoPath: string,
  audioPath: string,
  outPath: string,
): Promise<void> {
  await run("ffmpeg", [
    "-y",
    "-i", videoPath,
    "-i", audioPath,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    outPath,
  ]);
}

/** Supported xfade transition types (subset of ffmpeg xfade transitions). */
export type TransitionType =
  | "fade"
  | "slideleft"
  | "slideright"
  | "slideup"
  | "slidedown"
  | "circleopen"
  | "circleclose"
  | "dissolve"
  | "pixelize"
  | "wipeleft"
  | "wiperight"
  | "none";

export interface SceneTransition {
  type: TransitionType;
  durationSec: number;
}

/**
 * Concatenate clips with xfade transitions between them.
 *
 * For N clips with transitions T[0..N-2], produces a single output video.
 * Each transition overlaps `durationSec` seconds between adjacent clips.
 *
 * Clips MUST be re-encoded (not stream-copied) because xfade requires
 * decoded frames. We re-encode with the same quality settings as fitClipToDuration.
 */
export async function concatVideosWithTransitions(
  clipPaths: string[],
  transitions: (SceneTransition | null)[],
  outPath: string,
  fps = 30,
): Promise<void> {
  if (clipPaths.length === 0) throw new Error("concatVideosWithTransitions: empty clipPaths");

  // If only 1 clip or no transitions at all, fall back to simple concat
  if (clipPaths.length === 1) {
    await run("ffmpeg", ["-y", "-i", clipPaths[0], "-c", "copy", outPath]);
    return;
  }

  const allNone = transitions.every(t => !t || t.type === "none");
  if (allNone) {
    await concatVideos(clipPaths, outPath);
    return;
  }

  // Build the xfade filter chain.
  // For N clips: we need N-1 xfade filters chained together.
  // Each xfade needs the offset (start time of transition in the output timeline).
  const ffArgs: string[] = ["-y"];

  // Add all inputs
  for (const clip of clipPaths) {
    ffArgs.push("-i", clip);
  }

  // Get durations for offset calculation
  const durations: number[] = [];
  for (const clip of clipPaths) {
    const dur = await getDurationSec(clip);
    durations.push(dur);
  }

  // Build xfade filter chain
  const filterParts: string[] = [];
  let prevLabel = "[0:v]";
  let cumulativeOffset = 0;

  for (let i = 0; i < clipPaths.length - 1; i++) {
    const trans = transitions[i];
    const transType = trans?.type ?? "fade";
    const transDur = trans?.durationSec ?? 0.5;

    if (transType === "none" || transDur <= 0) {
      // No transition: just concatenate
      // We still need to chain through the filter for subsequent xfades
      cumulativeOffset += durations[i];
      const outLabel = i < clipPaths.length - 2 ? `[v${i}]` : "[vout]";
      filterParts.push(
        `${prevLabel}[${i + 1}:v]concat=n=2:v=1:a=0${outLabel}`
      );
      prevLabel = outLabel;
    } else {
      // Calculate offset: when the transition starts in the accumulated timeline
      const offset = cumulativeOffset + durations[i] - transDur;
      const outLabel = i < clipPaths.length - 2 ? `[v${i}]` : "[vout]";
      filterParts.push(
        `${prevLabel}[${i + 1}:v]xfade=transition=${transType}:duration=${transDur.toFixed(3)}:offset=${Math.max(0, offset).toFixed(3)}${outLabel}`
      );
      prevLabel = outLabel;
      // The output duration is reduced by transDur (the overlap)
      cumulativeOffset += durations[i] - transDur;
    }
  }

  ffArgs.push(
    "-filter_complex", filterParts.join(";"),
    "-map", "[vout]",
    "-an",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-r", String(fps),
    outPath,
  );

  await run("ffmpeg", ffArgs);
}

