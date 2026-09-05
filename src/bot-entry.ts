import { config } from "dotenv";
config({ path: ".env.local" });

import { run } from "@grammyjs/runner";
import { createBot } from "./bot/bot.js";
import { log } from "./utils/logger.js";

async function main() {
  try {
    const bot = createBot();

    log.info("Starting Telegram Bot (Long Polling)...");
    
    // grammy/runner helps handle long polling concurrently
    const runner = run(bot);

    // Stop the bot gracefully when the process exits
    const stopRunner = () => runner.isRunning() && runner.stop();
    process.once("SIGINT", stopRunner);
    process.once("SIGTERM", stopRunner);

  } catch (e) {
    log.error("Failed to start bot", e);
    process.exit(1);
  }
}

main();
