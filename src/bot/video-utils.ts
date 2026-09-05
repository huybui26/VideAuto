import { stat } from "fs/promises";
import { run } from "../render/video-tools.js";
import { join, dirname, basename, extname } from "path";
import { log } from "../utils/logger.js";

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB telegram limit

export async function compressForTelegram(videoPath: string): Promise<string> {
  const stats = await stat(videoPath);
  
  // If the video is already under 50MB, don't re-encode, just return it.
  if (stats.size < MAX_SIZE_BYTES) {
    return videoPath;
  }

  log.info(`Video is ${Math.round(stats.size / 1024 / 1024)}MB. Compressing for Telegram...`);
  const dir = dirname(videoPath);
  const base = basename(videoPath, extname(videoPath));
  const compressedPath = join(dir, `${base}_compressed.mp4`);

  // Target CRF 28 is generally good enough to reduce size significantly while retaining readable text
  // Fast preset to save bot processing time
  await run("ffmpeg", [
    "-y",
    "-i", videoPath,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "28",
    "-c:a", "aac",
    "-b:a", "128k",
    compressedPath
  ]);

  const newStats = await stat(compressedPath);
  log.info(`Compressed size: ${Math.round(newStats.size / 1024 / 1024)}MB`);
  
  return compressedPath;
}
