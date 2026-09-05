import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "./config.js";

const ENV_KEYS = ["TTS_PROVIDER", "OMNIVOICE_ENDPOINT", "TTS_CONCURRENCY", "ALLOWED_TELEGRAM_IDS"];

describe("loadConfig", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    ENV_KEYS.forEach((k) => delete process.env[k]);
  });

  afterEach(() => {
    Object.entries(saved).forEach(([k, v]) => {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    });
  });

  it("defaults to omnivoice with sensible defaults", () => {
    const cfg = loadConfig();
    expect(cfg.ttsProvider).toBe("omnivoice");
    expect(cfg.omnivoiceEndpoint).toBe("http://127.0.0.1:8123");
    expect(cfg.ttsConcurrency).toBe(1);
  });

  it("respects OMNIVOICE_ENDPOINT override", () => {
    process.env.OMNIVOICE_ENDPOINT = "http://localhost:9000";
    const cfg = loadConfig();
    expect(cfg.omnivoiceEndpoint).toBe("http://localhost:9000");
  });

  it("rejects any provider other than omnivoice", () => {
    process.env.TTS_PROVIDER = "elevenlabs";
    expect(() => loadConfig()).toThrow(/TTS_PROVIDER/);
  });

  it("defaults the Telegram allowlist to empty (bot denies everyone)", () => {
    expect(loadConfig().allowedTelegramIds).toEqual([]);
  });

  it("parses a comma-separated Telegram allowlist, ignoring whitespace", () => {
    process.env.ALLOWED_TELEGRAM_IDS = "123, 456 ,789,";
    expect(loadConfig().allowedTelegramIds).toEqual([123, 456, 789]);
  });

  it("rejects a non-numeric Telegram id", () => {
    process.env.ALLOWED_TELEGRAM_IDS = "123,@someone";
    expect(() => loadConfig()).toThrow(/ALLOWED_TELEGRAM_IDS/);
  });
});
