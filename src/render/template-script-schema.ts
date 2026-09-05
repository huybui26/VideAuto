import { z } from "zod";

/**
 * Script schema for the HyperFrames template pipeline. Each scene names a
 * vendored template under templates/<templateId>/ and supplies `inputs` matching that template's
 * data-composition-variables. The agent only fills text — the template owns the
 * visual design. inputs are kept loose here; each template validates its own.
 */

const SfxSpec = z.object({
  name: z.string().min(1),
  volume: z.number().min(0).max(1).default(0.4),
  startOffsetSec: z.number().default(0),
});
export type TplSfxSpecType = z.infer<typeof SfxSpec>;

const TransitionSpec = z.object({
  /** xfade transition type. Default "fade". */
  type: z.enum([
    "fade", "slideleft", "slideright", "slideup", "slidedown",
    "circleopen", "circleclose", "dissolve", "pixelize",
    "wipeleft", "wiperight", "none",
  ]).default("fade"),
  /** Duration of the transition in seconds. Default 0.5. */
  durationSec: z.number().min(0).max(2).default(0.5),
});
export type TransitionSpecType = z.infer<typeof TransitionSpec>;

const BgmSpec = z.object({
  /** Mood category: subdirectory name under assets/bgm/. */
  mood: z.string().min(1).default("lofi"),
  /** Volume relative to voice (0.0–1.0). Default 0.15. */
  volume: z.number().min(0).max(1).default(0.15),
});
export type BgmSpecType = z.infer<typeof BgmSpec>;

const TemplateScene = z.object({
  id: z.string().min(1),
  type: z.enum(["hook", "body", "outro"]),
  /** Spoken narration (Vietnamese, spelled-out numbers — see skill rules). */
  voiceText: z.string().min(1),
  /** Optional text to display in captions (if different from voiceText, e.g. "HTML" instead of "hát tê mờ lờ") */
  captionText: z.string().optional(),
  /** Folder name under templates/, e.g. "frame-bold-poster". */
  templateId: z.string().min(1),
  /** Text slots for the template's data-composition-variables. */
  inputs: z.record(z.string(), z.unknown()).default({}),
  /** Optional SFX override (else picked per scene.type + voiceText keywords). */
  sfx: SfxSpec.optional(),
  /** Optional transition to the NEXT scene (ignored on last scene). */
  transition: TransitionSpec.optional(),
  /** Optional AI Visual Layer hints for dynamically fetching images. */
  visual: z.object({
    searchQuery: z.string().optional(),
    imagePrompt: z.string().optional(),
    imageStyle: z.string().optional(),
    iconQuery: z.string().optional(),
    placement: z.enum(["background", "hero", "thumbnail", "overlay"]).default("background"),
  }).optional(),
});
export type TemplateSceneType = z.infer<typeof TemplateScene>;

/**
 * Dynamic theme — AI picks colors per video topic so every video looks unique.
 * Templates read these via `v.__theme` and set CSS custom properties on `#root`.
 * When omitted, each template falls back to its own hard-coded defaults.
 */
const ThemeSpec = z.object({
  /** Main background color */
  bgPrimary: z.string().optional(),
  /** Secondary background (gradient end, card bg, etc.) */
  bgSecondary: z.string().optional(),
  /** Primary text color */
  textPrimary: z.string().optional(),
  /** Secondary/muted text color */
  textSecondary: z.string().optional(),
  /** Primary accent (highlights, badges, key numbers) */
  accent1: z.string().optional(),
  /** Secondary accent (subheadlines, tags, secondary highlights) */
  accent2: z.string().optional(),
  /** Background effect color 1 (blobs, bubbles, glows) */
  blob1: z.string().optional(),
  /** Background effect color 2 */
  blob2: z.string().optional(),
  /** Background effect color 3 */
  blob3: z.string().optional(),
  /** Visual mood — drives template light/dark base */
  mood: z.enum(["dark", "light"]).default("dark"),
});
export type ThemeSpecType = z.infer<typeof ThemeSpec>;

const CaptionSpec = z.object({
  /** style of the subtitle */
  style: z.enum(["karaoke", "static", "none"]).default("karaoke"),
  /** font size in pixels */
  fontSize: z.number().default(85),
  /** hex color of the inactive text */
  color: z.string().default("#FFFFFF"),
  /** hex color of the highlighted text (karaoke mode) */
  activeColor: z.string().default("#FFD700"),
  /** Y-offset from the bottom of the screen (in pixels) */
  yOffset: z.number().default(250),
});
export type CaptionSpecType = z.infer<typeof CaptionSpec>;

export const TemplateScriptSchema = z.object({
  version: z.literal("1.0"),
  /** Discriminator: marks this as a HyperFrames-template script. */
  renderer: z.literal("hyperframes"),
  metadata: z.object({
    title: z.string().min(1),
    source: z.object({
      url: z.string(),
      domain: z.string(),
      image: z.string().url().nullable(),
    }),
    channel: z.string().min(1),
  }),
  voice: z.object({
    provider: z.literal("omnivoice").default("omnivoice"),
    speed: z.number().min(0.5).max(2.0),
  }),
  /** Output aspect for every scene (templates render a matching composition). */
  aspect: z.enum(["9:16"]).default("9:16"),
  /**
   * Optional per-video color theme. Merged into every scene's inputs as
   * `__theme`; templates read it and override their CSS custom properties.
   * Must be declared here or Zod strips it off the parsed script.
   */
  theme: ThemeSpec.optional(),
  /** Optional background music config. Omit or set to null to skip BGM. */
  bgm: BgmSpec.optional(),
  /** Optional caption config. Omit to skip captions. */
  caption: CaptionSpec.optional(),
  scenes: z
    .array(TemplateScene)
    .min(3)
    .max(12)
    .refine((s) => s[0]?.type === "hook", { message: "scenes[0] must be type=hook" })
    .refine((s) => s[s.length - 1]?.type === "outro", { message: "last scene must be type=outro" }),
});

export type TemplateScript = z.infer<typeof TemplateScriptSchema>;
