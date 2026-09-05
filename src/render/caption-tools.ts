import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../utils/logger.js";
import { type CaptionSpecType } from "./template-script-schema.js";
import { run } from "./video-tools.js"; // Reuse run from video-tools

export interface WordTiming {
  word: string;
  startSec: number;
  endSec: number;
}

export interface WhisperChunk {
  text: string;
  timestamp: [number, number];
}

export interface TranscribeResult {
  text: string;
  chunks: WhisperChunk[];
  error?: string;
}

/**
 * Run the python transcribe script using the OmniVoice venv.
 */
export async function runTranscriber(audioPath: string): Promise<TranscribeResult> {
  return new Promise((resolve, reject) => {
    // Determine path to transcribe.py
    const transcribePy = join(process.cwd(), "scripts", "transcribe.py");
    const venvActivate = join(process.cwd(), "..", "OmniVoice", "venv", "bin", "activate");

    // Execute via bash to activate venv
    const cmd = `source "${venvActivate}" && python "${transcribePy}" "${audioPath}"`;

    const p = spawn("bash", ["-c", cmd]);

    let stdout = "";
    let stderr = "";

    p.stdout.on("data", (data) => (stdout += data.toString()));
    p.stderr.on("data", (data) => (stderr += data.toString()));

    p.on("close", (code) => {
      if (code !== 0) {
        log.error(`Transcriber failed with code ${code}\n${stderr}`);
        reject(new Error(`Transcriber failed: ${stderr}`));
        return;
      }
      try {
        const jsonLines = stdout.trim().split("\n");
        const lastLine = jsonLines[jsonLines.length - 1]; // In case transformers prints warnings
        const res = JSON.parse(lastLine) as TranscribeResult;
        if (res.error) throw new Error(res.error);
        resolve(res);
      } catch (e) {
        log.error(`Failed to parse transcriber output:\n${stdout}`);
        reject(e);
      }
    });
  });
}

/**
 * Align original text words to Whisper chunk timestamps.
 * Distributes timings linearly if lengths mismatch (simple fallback).
 */
export function alignTimestamps(originalText: string, chunks: WhisperChunk[]): WordTiming[] {
  // Normalize original text into words
  const words = originalText.trim().split(/\s+/);
  if (words.length === 0 || chunks.length === 0) return [];

  const timings: WordTiming[] = [];
  
  // If exact match (very common since both are phonetic/short sentences)
  if (words.length === chunks.length) {
    for (let i = 0; i < words.length; i++) {
      timings.push({
        word: words[i],
        startSec: chunks[i].timestamp[0] ?? 0,
        endSec: chunks[i].timestamp[1] ?? (chunks[i].timestamp[0] + 0.5),
      });
    }
    return timings;
  }

  // Fallback: Mismatched lengths. Map proportionally.
  // E.g. whisper has 15 chunks, original has 14 words.
  const totalDuration = (chunks[chunks.length - 1].timestamp[1] ?? chunks[chunks.length - 1].timestamp[0] + 0.5) - (chunks[0].timestamp[0] ?? 0);
  const startOffset = chunks[0].timestamp[0] ?? 0;
  
  for (let i = 0; i < words.length; i++) {
    // Proportional start/end
    const pStart = i / words.length;
    const pEnd = (i + 1) / words.length;
    timings.push({
      word: words[i],
      startSec: startOffset + (pStart * totalDuration),
      endSec: startOffset + (pEnd * totalDuration),
    });
  }
  
  return timings;
}

/**
 * Format a seconds timestamp to ASS format: H:MM:SS.cc
 */
function toAssTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

/**
 * Convert hex color (#RRGGBB) to ASS color (&HBBGGRR&)
 */
function toAssColor(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "&H00FFFFFF&"; // default white
  const r = c.substring(0, 2);
  const g = c.substring(2, 4);
  const b = c.substring(4, 6);
  return `&H00${b}${g}${r}&`;
}

/**
 * Generate ASS subtitle file content from word timings.
 */
export async function generateAssSubtitles(
  timings: WordTiming[],
  spec: CaptionSpecType,
  outPath: string
): Promise<void> {
  const primaryColor = toAssColor(spec.activeColor); // e.g. Yellow
  const secondaryColor = toAssColor(spec.color);     // e.g. White
  
  // Create ASS header
  // Default style uses secondaryColor as base, thick outline (8)
  let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${spec.fontSize},${secondaryColor},${secondaryColor},&H00000000&,&H80000000&,1,0,0,0,100,100,0,0,1,8,0,2,40,40,${spec.yOffset},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const WORDS_PER_CHUNK = 4;
  for (let i = 0; i < timings.length; i += WORDS_PER_CHUNK) {
    const chunk = timings.slice(i, i + WORDS_PER_CHUNK);
    
    if (spec.style === "static") {
      const start = toAssTime(chunk[0].startSec);
      const end = toAssTime(chunk[chunk.length - 1].endSec);
      const textLine = chunk.map(t => t.word).join(" ");
      ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${textLine}\n`;
    } else {
      // "karaoke" (Hormozi style)
      for (let j = 0; j < chunk.length; j++) {
        const activeWord = chunk[j];
        const start = toAssTime(activeWord.startSec);
        // Extend duration to the start of the next word to prevent flickering, 
        // unless it's the last word in the chunk.
        const endSec = j < chunk.length - 1 ? chunk[j+1].startSec : activeWord.endSec;
        const end = toAssTime(endSec);
        
        let textLine = "";
        for (let k = 0; k < chunk.length; k++) {
          const w = chunk[k].word;
          if (k === j) {
            // Active word: Primary color only (no pop-up bounce)
            textLine += `{\\c${primaryColor}}${w}{\\r} `;
          } else {
            // Inactive word
            textLine += `${w} `;
          }
        }
        
        ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${textLine.trim()}\n`;
      }
    }
  }

  await writeFile(outPath, ass, "utf8");
}

/**
 * Burn ASS subtitles onto the video.
 * Note: Re-encodes the video using libx264.
 */
export async function burnSubtitlesToVideo(
  inVideo: string,
  assPath: string,
  outVideo: string,
  fps = 30
): Promise<void> {
  await run("ffmpeg", [
    "-y",
    "-i", inVideo,
    "-vf", `ass='${assPath}',scale=1080:1920:force_original_aspect_ratio=disable`,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-r", String(fps),
    outVideo
  ]);
}
