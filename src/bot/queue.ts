import { Bot, Context, InputFile } from "grammy";
import { runTemplatePipeline } from "../render/template-pipeline.js";
import { compressForTelegram } from "./video-utils.js";
import { reportProgress } from "./progress-reporter.js";
import { log } from "../utils/logger.js";
import { join } from "path";
import { rm } from "fs/promises";
import { existsSync } from "fs";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface RenderJob {
  id: string;
  chatId: number;
  messageId?: number; // The message showing the progress bar
  scriptPath: string; // Path to the script.json file to render
  workDir: string;    // Directory containing the script.json
  status: JobStatus;
  progressMessage?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

class JobQueue {
  private queue: RenderJob[] = [];
  private isProcessing = false;
  private bot: Bot | null = null;

  setBot(bot: Bot) {
    this.bot = bot;
  }

  async addJob(job: RenderJob) {
    this.queue.push(job);
    log.info(`[Queue] Job ${job.id} added. Queue length: ${this.queue.length}`);
    this.processNext();
  }

  getJob(id: string): RenderJob | undefined {
    return this.queue.find((j) => j.id === id);
  }

  getJobsByChat(chatId: number): RenderJob[] {
    return this.queue.filter((j) => j.chatId === chatId);
  }

  cancelJob(id: string, chatId: number): boolean {
    const idx = this.queue.findIndex((j) => j.id === id && j.chatId === chatId);
    if (idx !== -1 && this.queue[idx].status === "pending") {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  private async processNext() {
    if (this.isProcessing) return;
    
    // Find the next pending job
    const job = this.queue.find((j) => j.status === "pending");
    if (!job) return;

    this.isProcessing = true;
    job.status = "processing";
    job.startedAt = new Date();

    try {
      log.info(`[Queue] Processing job ${job.id}...`);
      
      if (this.bot && job.messageId) {
        await this.bot.api.editMessageText(
          job.chatId,
          job.messageId,
          `🔄 Job ${job.id} is starting...`
        );
      }

      // Run Pipeline
      const result = await runTemplatePipeline(job.scriptPath, async (step, total, msg) => {
        if (this.bot && job.messageId) {
          await reportProgress(this.bot, job.chatId, job.messageId, step, total, msg);
        }
      });

      // Compress if needed
      let finalVideoPath = result.videoPath;
      try {
        log.info(`[Queue] Compressing video for Telegram...`);
        finalVideoPath = await compressForTelegram(result.videoPath);
      } catch (e) {
        log.warn(`[Queue] Compression failed, trying to send original video: ${e}`);
      }

      // Send the video
      if (this.bot) {
        await this.bot.api.sendVideo(job.chatId, new InputFile(finalVideoPath), {
          caption: `✅ Render complete!\nDuration: ${result.durationSec.toFixed(1)}s`,
          reply_parameters: job.messageId ? { message_id: job.messageId } : undefined,
        });

        if (job.messageId) {
           await this.bot.api.editMessageText(
             job.chatId,
             job.messageId,
             `✅ Job ${job.id} completed.`
           );
        }
      }

      job.status = "completed";
      job.completedAt = new Date();

    } catch (err) {
      log.error(`[Queue] Job ${job.id} failed`, err);
      job.status = "failed";
      job.error = err instanceof Error ? err.message : String(err);
      job.completedAt = new Date();

      if (this.bot && job.messageId) {
        await this.bot.api.editMessageText(
          job.chatId,
          job.messageId,
          `❌ Job ${job.id} failed:\n${job.error}`
        ).catch(() => {});
      }
    } finally {
      this.isProcessing = false;
      // Clean up the job directory to save space (keep logs maybe?)
      try {
        if (existsSync(job.workDir)) {
          await rm(job.workDir, { recursive: true, force: true });
        }
      } catch (e) {
        log.error(`[Queue] Failed to clean up ${job.workDir}`, e);
      }
      this.processNext();
    }
  }
}

export const jobQueue = new JobQueue();
