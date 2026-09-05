import { Bot } from "grammy";

// To prevent hitting Telegram API rate limits, we should debounce edits
// but for now we just edit directly since there are only 10 steps.
// A simple progress bar.

export async function reportProgress(
  bot: Bot,
  chatId: number,
  messageId: number,
  step: number,
  total: number,
  msg: string
) {
  const barLen = 10;
  const filled = Math.round((step / total) * barLen);
  const empty = barLen - filled;
  const bar = "⬛".repeat(filled) + "⬜".repeat(empty);

  const text = `${bar} ${step}/${total} — ${msg}`;

  try {
    await bot.api.editMessageText(chatId, messageId, text);
  } catch (err) {
    // Ignore message not modified errors
    if (err instanceof Error && err.message.includes("message is not modified")) {
      return;
    }
    console.error(`Failed to update progress: ${err}`);
  }
}
