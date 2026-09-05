/**
 * Background Music (BGM) Mixer
 *
 * Mixes a background music track underneath a voice+SFX audio track with:
 * - Auto-loop or trim to match voice duration
 * - Sidechain-style ducking: BGM volume drops when voice is present
 * - Fade-in at start, fade-out at end
 *
 * Uses ffmpeg's `sidechaincompress` filter for natural ducking.
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { getDurationSec } from "./audio-tools.js";
import { log } from "../utils/logger.js";

function run(cmd: string, args: string[]): Promise<string> {
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

/** Available mood categories (subdirectory names under assets/bgm/) */
export type BgmMood = "lofi" | "cinematic" | "upbeat" | "chill" | "tech";

export interface BgmMixOptions {
  /** Volume of BGM relative to voice (0.0–1.0). Default 0.15 */
  volume?: number;
  /** Fade-in duration in seconds. Default 2.0 */
  fadeInSec?: number;
  /** Fade-out duration in seconds. Default 3.0 */
  fadeOutSec?: number;
}

/**
 * Pick a BGM track from assets/bgm/<mood>/.
 * Selection is deterministic based on a seed string (e.g. script title).
 */
export function pickBgmTrack(bgmDir: string, mood: string, seed: string): string | null {
  const moodDir = join(bgmDir, mood);
  if (!existsSync(moodDir)) {
    // Fall back: try any available mood directory
    const available = existsSync(bgmDir)
      ? readdirSync(bgmDir).filter(d => {
          try { return statSync(join(bgmDir, d)).isDirectory(); }
          catch { return false; }
        })
      : [];
    if (available.length === 0) return null;
    return pickBgmTrack(bgmDir, available[0], seed);
  }

  const files = readdirSync(moodDir).filter(f => f.toLowerCase().endsWith(".mp3"));
  if (files.length === 0) return null;

  // Deterministic hash pick
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i);
    h |= 0;
  }
  const idx = Math.abs(h) % files.length;
  return join(moodDir, files.sort()[idx]);
}

/**
 * Mix a BGM track underneath a voice audio file.
 *
 * Strategy:
 * 1. Loop the BGM track to match voice duration (if BGM shorter)
 * 2. Apply volume, fade-in, fade-out to BGM
 * 3. Use `sidechaincompress` to duck BGM when voice is loud
 * 4. Mix voice + ducked BGM into final output
 */
export async function mixBgmOntoAudio(
  voicePath: string,
  bgmPath: string,
  outPath: string,
  opts: BgmMixOptions = {},
): Promise<void> {
  const { volume = 0.15, fadeInSec = 2.0, fadeOutSec = 3.0 } = opts;

  const voiceDur = await getDurationSec(voicePath);
  const bgmDur = await getDurationSec(bgmPath);

  log.info(`  BGM: ${basename(bgmPath)} (${bgmDur.toFixed(1)}s) → voice ${voiceDur.toFixed(1)}s, vol=${volume}`);

  // Build BGM filter chain:
  // 1. Loop if needed (aloop or stream_loop)
  // 2. Trim to voice duration
  // 3. Apply volume + fades
  // 4. Sidechain compress (duck when voice is present)
  const needsLoop = bgmDur < voiceDur;
  const loopCount = needsLoop ? Math.ceil(voiceDur / bgmDur) : 0;

  const ffArgs: string[] = ["-y"];

  // Input 0: voice (the sidechain source)
  ffArgs.push("-i", voicePath);

  // Input 1: BGM (loop if needed)
  if (needsLoop) {
    ffArgs.push("-stream_loop", String(loopCount));
  }
  ffArgs.push("-i", bgmPath);

  // Filter graph
  const filters: string[] = [];

  // Voice: normalize to 44100 mono
  filters.push(
    `[0:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono[voice]`
  );

  // BGM: resample, trim to voice duration, apply volume + fades
  filters.push(
    `[1:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,` +
    `atrim=0:${voiceDur.toFixed(3)},asetpts=PTS-STARTPTS,` +
    `volume=${volume},` +
    `afade=t=in:st=0:d=${fadeInSec.toFixed(2)},` +
    `afade=t=out:st=${Math.max(0, voiceDur - fadeOutSec).toFixed(3)}:d=${fadeOutSec.toFixed(2)}[bgm_raw]`
  );

  // Sidechain compress: duck BGM when voice is loud
  // attack=0.01 (fast duck), release=0.5 (smooth return)
  // threshold=0.02 (sensitive to quiet speech), ratio=6 (strong ducking)
  filters.push(
    `[bgm_raw][voice]sidechaincompress=threshold=0.02:ratio=6:attack=10:release=500:level_in=1:level_sc=1[bgm_ducked]`
  );

  // Final mix: voice + ducked BGM
  filters.push(
    `[voice][bgm_ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`
  );

  ffArgs.push(
    "-filter_complex", filters.join(";"),
    "-map", "[out]",
    "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "44100",
    outPath,
  );

  await run("ffmpeg", ffArgs);
}
