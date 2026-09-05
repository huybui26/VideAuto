import { Bot } from "grammy";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { jobQueue } from "../queue.js";
import { log } from "../../utils/logger.js";

export function registerStartHandler(bot: Bot) {
  bot.command("start", (ctx) => {
    ctx.reply(
      "🎬 Chào bạn! Tôi là VideAuto Bot.\n\n" +
      "Gửi file script.json hoặc dùng lệnh /render để bắt đầu tạo video.\n\n" +
      "📋 Lệnh có sẵn:\n" +
      "/render — Tạo video từ kịch bản\n" +
      "/templates — Xem danh sách templates\n" +
      "/status — Kiểm tra tiến độ của bạn\n" +
      "/cancel — Huỷ job đang chờ"
    );
  });
}

export function registerStatusHandler(bot: Bot) {
  bot.command("status", (ctx) => {
    const jobs = jobQueue.getJobsByChat(ctx.chat.id);
    const activeJobs = jobs.filter(j => j.status === "pending" || j.status === "processing");
    
    if (activeJobs.length === 0) {
      return ctx.reply("Bạn không có video nào đang được xử lý.");
    }
    
    const msg = activeJobs.map(j => `- Job ${j.id}: ${j.status}`).join("\n");
    ctx.reply(`Các video đang xử lý:\n${msg}`);
  });
}

export function registerCancelHandler(bot: Bot) {
  bot.command("cancel", (ctx) => {
    // Basic implementation: cancel the most recent pending job
    const jobs = jobQueue.getJobsByChat(ctx.chat.id);
    const pendingJobs = jobs.filter(j => j.status === "pending");
    
    if (pendingJobs.length === 0) {
      return ctx.reply("Bạn không có job nào đang CHỜ (pending) để có thể huỷ. (Không thể huỷ job đang render).");
    }
    
    const jobToCancel = pendingJobs[pendingJobs.length - 1];
    const success = jobQueue.cancelJob(jobToCancel.id, ctx.chat.id);
    
    if (success) {
      ctx.reply(`Đã huỷ job ${jobToCancel.id} thành công.`);
    } else {
      ctx.reply(`Không thể huỷ job ${jobToCancel.id}.`);
    }
  });
}

export function registerTemplatesHandler(bot: Bot) {
  bot.command("templates", (ctx) => {
    // List the templates that actually exist on disk — a hardcoded list drifts
    // every time a template is added or removed.
    const templatesDir = join(process.cwd(), "templates");
    let ids: string[] = [];
    try {
      ids = readdirSync(templatesDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(join(templatesDir, e.name, "index.html")))
        .map((e) => e.name)
        .sort();
    } catch (err) {
      log.error("Failed to read templates directory", err);
      return ctx.reply("❌ Không đọc được thư mục templates/.");
    }

    if (ids.length === 0) return ctx.reply("Chưa có template nào trong thư mục templates/.");

    return ctx.reply(
      `Danh sách Templates hiện có (${ids.length}):\n\n` +
        ids.map((id, i) => `${i + 1}. ${id}`).join("\n"),
    );
  });
}
