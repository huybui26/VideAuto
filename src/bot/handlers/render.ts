import { Bot } from "grammy";
import { jobQueue } from "../queue.js";
import { generateScriptFromText } from "../ai-generator.js";
import { join } from "path";
import { mkdir, writeFile } from "fs/promises";
import { TemplateScriptSchema } from "../../render/template-script-schema.js";
import { log } from "../../utils/logger.js";
import { randomUUID } from "crypto";

export function registerRenderHandler(bot: Bot) {
  // Handle text prompt for AI generation
  bot.command("render", async (ctx) => {
    const prompt = ctx.match;
    if (!prompt) {
      return ctx.reply("Vui lòng cung cấp mô tả kịch bản (VD: `/render Làm video so sánh React và Vue`) hoặc gửi trực tiếp file `script.json`.");
    }

    const waitMsg = await ctx.reply("🤖 Đang nhờ AI viết kịch bản. Vui lòng đợi...");

    try {
      const script = await generateScriptFromText(prompt);
      
      const jobId = randomUUID().split("-")[0];
      const workDir = join(process.cwd(), "output", `tg-${jobId}`);
      await mkdir(workDir, { recursive: true });
      
      const scriptPath = join(workDir, "script.json");
      await writeFile(scriptPath, JSON.stringify(script, null, 2), "utf8");

      await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `✅ Kịch bản đã được AI tạo thành công!`);
      
      const progressMsg = await ctx.reply(`🔄 Đã thêm vào hàng đợi (Job ${jobId})...`);
      
      jobQueue.addJob({
        id: jobId,
        chatId: ctx.chat.id,
        messageId: progressMsg.message_id,
        scriptPath,
        workDir,
        status: "pending",
        createdAt: new Date(),
      });
      
    } catch (err) {
      log.error("AI Generation failed", err);
      await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `❌ Lỗi khi tạo kịch bản: ${err instanceof Error ? err.message : err}`);
    }
  });

  // Handle document upload (script.json)
  bot.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    
    if (!doc.file_name?.endsWith(".json")) {
      return ctx.reply("Vui lòng gửi file định dạng .json");
    }

    const waitMsg = await ctx.reply("📥 Đang tải và kiểm tra file...");

    try {
      const file = await ctx.api.getFile(doc.file_id);
      if (!file.file_path) throw new Error("Không thể tải file từ Telegram");

      const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("Download failed");

      const rawJson = await response.json();
      
      // Validate schema
      TemplateScriptSchema.parse(rawJson);

      const jobId = randomUUID().split("-")[0];
      const workDir = join(process.cwd(), "output", `tg-${jobId}`);
      await mkdir(workDir, { recursive: true });
      
      const scriptPath = join(workDir, "script.json");
      await writeFile(scriptPath, JSON.stringify(rawJson, null, 2), "utf8");

      await ctx.api.editMessageText(ctx.chat.id, waitMsg.message_id, `✅ File hợp lệ!`);
      const progressMsg = await ctx.reply(`🔄 Đã thêm vào hàng đợi (Job ${jobId})...`);

      jobQueue.addJob({
        id: jobId,
        chatId: ctx.chat.id,
        messageId: progressMsg.message_id,
        scriptPath,
        workDir,
        status: "pending",
        createdAt: new Date(),
      });

    } catch (err) {
      log.error("Document handle failed", err);
      await ctx.api.editMessageText(
        ctx.chat.id, 
        waitMsg.message_id, 
        `❌ File không hợp lệ hoặc lỗi server:\n${err instanceof Error ? err.message : err}`
      );
    }
  });
}
