import "dotenv/config";

export type TtsProvider = "omnivoice";

export interface Config {
    ttsProvider: TtsProvider;
    // OmniVoice (local TTS server)
    omnivoiceEndpoint: string;
    ttsConcurrency: number;
    // Telegram Bot
    telegramBotToken?: string;
    /** Telegram user IDs allowed to use the bot. Empty = nobody (bot rejects all). */
    allowedTelegramIds: number[];
    // Gemini API
    geminiApiKey?: string;
    // Pexels API
    pexelsApiKey?: string;
}

/**
 * Parse a comma-separated list of Telegram numeric user IDs.
 * Blank/absent → empty list, which the bot treats as "deny everyone".
 */
function idList(name: string): number[] {
    const v = process.env[name];
    if (!v) return [];
    return v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
            const n = parseInt(s, 10);
            if (isNaN(n))
                throw new Error(`Env var ${name} must be a comma-separated list of numeric Telegram user IDs, got "${s}"`);
            return n;
        });
}

function intDefault(name: string, def: number): number {
    const v = process.env[name];
    if (!v) return def;
    const n = parseInt(v, 10);
    if (isNaN(n))
        throw new Error(`Env var ${name} must be integer, got "${v}"`);
    return n;
}

export function loadConfig(): Config {
    const provider = (process.env.TTS_PROVIDER ?? "omnivoice") as TtsProvider;
    if (provider !== "omnivoice") {
        throw new Error(
            `TTS_PROVIDER must be "omnivoice", got "${provider}"`,
        );
    }

    return {
        ttsProvider: provider,
        omnivoiceEndpoint:
            process.env.OMNIVOICE_ENDPOINT ?? "http://127.0.0.1:8123",
        ttsConcurrency: intDefault("TTS_CONCURRENCY", 1),
        telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
        allowedTelegramIds: idList("ALLOWED_TELEGRAM_IDS"),
        geminiApiKey: process.env.GEMINI_API_KEY,
        pexelsApiKey: process.env.PEXELS_API_KEY,
    };
}

