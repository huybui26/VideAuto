import { Bot, Context } from "grammy";
import { registerStartHandler, registerStatusHandler, registerCancelHandler, registerTemplatesHandler } from "./handlers/simple-commands.js";
import { registerRenderHandler } from "./handlers/render.js";
import { jobQueue } from "./queue.js";
import { loadConfig } from "../config.js";
import { log } from "../utils/logger.js";

export function createBot(): Bot {
  const cfg = loadConfig();
  if (!cfg.telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured in environment variables.");
  }

  const bot = new Bot(cfg.telegramBotToken);

  // Auth gate — every render burns GPU time, Gemini quota and disk on this
  // machine, so only explicitly allowlisted Telegram accounts get through.
  // An unset ALLOWED_TELEGRAM_IDS denies everyone (fail closed) rather than
  // leaving the bot open to anyone who finds its username.
  if (cfg.allowedTelegramIds.length === 0) {
    log.warn(
      "ALLOWED_TELEGRAM_IDS is empty — the bot will reject every request. " +
        "Set it in .env.local to your numeric Telegram user ID (ask @userinfobot).",
    );
  }
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (userId === undefined || !cfg.allowedTelegramIds.includes(userId)) {
      log.warn(`[Bot] Rejected unauthorized user ${userId ?? "unknown"} (@${ctx.from?.username ?? "?"})`);
      await ctx
        .reply(`⛔ Bạn không có quyền sử dụng bot này.\nTelegram ID của bạn: ${userId ?? "không xác định"}`)
        .catch(() => {});
      return;
    }
    await next();
  });

  // Catch errors globally
  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof Error) {
      console.error(e.message);
    } else {
      console.error(e);
    }
  });

  // Basic middleware to log messages
  bot.use(async (ctx, next) => {
    if (ctx.message?.text) {
      log.info(`[Bot] Received message from ${ctx.from?.username}: ${ctx.message.text}`);
    }
    await next();
  });

  // Register Handlers
  registerStartHandler(bot);
  registerStatusHandler(bot);
  registerCancelHandler(bot);
  registerTemplatesHandler(bot);
  registerRenderHandler(bot);

  // Connect Queue to Bot so it can send messages
  jobQueue.setBot(bot);

  return bot;
}
