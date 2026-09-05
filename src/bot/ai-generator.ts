import { GoogleGenAI } from "@google/genai";
import { TemplateScriptSchema, type TemplateScript } from "../render/template-script-schema.js";
import { loadConfig } from "../config.js";
import { log } from "../utils/logger.js";
import { readFile } from "fs/promises";
import { join } from "path";

const SYSTEM_PROMPT = `
You are an elite TikTok/Shorts Video Producer & Scriptwriter.
Your task is to transform a user's prompt (which could be about tech like SQL/Python, stories, or any topic) into a highly engaging, viral 9:16 video script using our visual templates.

CORE STRATEGY (High Quality & Token Efficient):
- Storytelling First: Structure the video with a strong HOOK (grab attention in 3 seconds), a concise BODY (deliver value or story), and an OUTRO (call to action).
- Concise & Punchy: Short-form video requires fast pacing. Keep sentences short. Do not over-explain.
- Smart Template Selection: Pick the exact right template for the emotion (e.g., 'comparison' for A vs B, 'list' for steps/reasons, 'build-minimal' for a dramatic reveal, 'glass-hero' for a modern intro).

TECHNICAL RULES:
1. "voiceText" MUST spell out numbers and symbols phonetically in Vietnamese for the TTS (e.g. "một trăm", "ét quy eo" cho SQL, "cộng cộng" cho ++, "chát gi bi ti" cho ChatGPT).
2. "captionText" (REQUIRED) must be the clean, grammatically correct text shown in subtitles (e.g. "100", "SQL", "C++", "ChatGPT"). Always provide this.
3. Always start with a "hook" scene and end with an "outro" scene. Total scenes should be between 3 to 8.
4. SMART DESIGN SKILL:
   - Inline Emojis: Use emojis SPARINGLY (0-1 per field) and ONLY in small UI fields (like kicker, badge, cta). NEVER put emojis in large typography fields (like figure, hero, headline) as it breaks the professional design.
   - Stickers (iconQuery): Only use stickers when the scene needs a strong visual punch.
5. Return ONLY a pure, raw JSON object. NO markdown formatting (like json), NO extra text. This saves tokens.
6. ONLY use templates explicitly defined in the TEMPLATE CATALOG below. Follow their exact 'inputs' schema.
7. SOUND EFFECTS (SFX): The system relies on you to explicitly trigger SFX for maximum impact. Add \`"sfx": { "name": "<category>" }\` to a scene ONLY when there is a major reveal, shock, or transition (e.g. \`"sfx": { "name": "cinematic" }\` or \`"sfx": { "name": "alert" }\`). DO NOT spam SFX on every scene. Categories: transition, emphasis, alert, success, fail, reveal, countdown, cinematic, drumroll, outro.
8. AI VISUAL LAYER: For templates that support background images (like \`frame-image-hero\`, \`frame-visual-body\`), you MUST provide a \`"visual"\` object. You can generate custom AI art or use stock photos.
   - GENERATIVE AI ART (PREFERRED): Provide \`imagePrompt\` (a highly detailed English prompt for an AI Image Generator) and \`imageStyle\` (e.g. "3d_cartoon", "cinematic", "flat_vector_art"). The AI will draw this image in 9:16 aspect ratio! Example: \`"visual": { "imagePrompt": "A cute astronaut riding a dinosaur in space, vibrant colors", "imageStyle": "3d_animation", "iconQuery": "rocket" }\`.
   - STOCK PHOTOS (FALLBACK): Provide \`searchQuery\` (English keyword for a realistic background photo).
   - ICONS (CRITICAL): Provide \`iconQuery\` (English keyword for a floating SVG sticker/emoji, e.g. "robot", "fire"). This triggers our high-quality 3D Fluent Emoji engine. This is the BEST way to add a premium 3D sticker to the screen. Always use this instead of plain text emojis for main visuals!
   Always match the \`imageStyle\` with the topic of the video for a cohesive aesthetic!

THEME SYSTEM (CRITICAL FOR VISUAL DIVERSITY):
You MUST include a "theme" object at the root level of your JSON to set the visual mood of the ENTIRE video.
Pick colors and a mood ('dark' or 'light') that perfectly match the TOPIC. Be creative!
- Dating/Love/Romance → warm pinks, reds (bg: #fff0f3, accent: #ff4d6d, mood: 'light')
- Finance/Money/Business → rich greens, golds (bg: #064e3b, accent: #fbbf24, mood: 'dark')
- Tech/AI/Coding → cyberpunk blues, cyans (bg: #020c1a, accent: #5ce1e6, mood: 'dark')
- Food/Cooking → warm oranges, creams (bg: #fef3c7, accent: #ea580c, mood: 'light')
- Gaming/Esports → neon purples, toxic greens (bg: #0d0021, accent: #22c55e, mood: 'dark')
- Health/Fitness → fresh greens, clean whites (bg: #f0fdf4, accent: #16a34a, mood: 'light')
- Education/Science → calm blues, whites (bg: #e0e7ff, accent: #4f46e5, mood: 'light')
- Horror/Mystery → deep blacks, blood reds (bg: #000000, accent: #991b1b, mood: 'dark')

The theme object schema is:
"theme": { "bgPrimary": "hex", "bgSecondary": "hex", "textPrimary": "hex", "textSecondary": "hex", "accent1": "hex", "accent2": "hex", "blob1": "hex", "blob2": "hex", "blob3": "hex", "mood": "dark|light" }
Choose colors carefully to ensure text is highly legible against the background.
`;

const EXAMPLE_JSON = `
Example JSON output:
{
  "version": "1.0",
  "renderer": "hyperframes",
  "metadata": {
    "title": "Example Video",
    "source": { "url": "", "domain": "", "image": null },
    "channel": "VideAuto"
  },
  "voice": { "provider": "omnivoice", "speed": 1.0 },
  "aspect": "9:16",
  "theme": { 
    "bgPrimary": "#020c1a", "bgSecondary": "#0a1628", 
    "textPrimary": "#fafaf8", "textSecondary": "rgba(250,250,248,0.55)", 
    "accent1": "#ff4d6d", "accent2": "#5ce1e6", 
    "blob1": "#1565c0", "blob2": "#0d47a1", "blob3": "#1976d2", 
    "mood": "dark" 
  },
  "bgm": { "mood": "lofi", "volume": 0.15 },
  "caption": { "style": "karaoke", "color": "#FFFFFF", "activeColor": "#FFD700" },
  "scenes": [
    {
      "id": "scene-1",
      "type": "hook",
      "voiceText": "Chào các bạn! Hôm nay chúng ta sẽ tìm hiểu về một khái niệm mới.",
      "captionText": "Chào các bạn! Hôm nay chúng ta sẽ tìm hiểu về một khái niệm mới.",
      "templateId": "frame-image-hero",
      "visual": {
        "imagePrompt": "A highly detailed professional workspace with a modern laptop, glowing screen, and a hot cup of coffee",
        "imageStyle": "cinematic",
        "iconQuery": "coffee",
        "placement": "background"
      },
      "inputs": {
        "kicker": "KIẾN THỨC MỚI",
        "headline": ["Tiêu Đề", "Chính"],
        "standfirst": "Phụ đề giới thiệu cực chất",
        "footer_left": "Kênh Kiến Thức",
        "footer_right": "video-bai-giang"
      }
    },
    {
      "id": "scene-2",
      "type": "body",
      "voiceText": "Về cơ bản, phương pháp A có một số nhược điểm, trong khi ét quy eo lại tối ưu hơn.",
      "captionText": "Về cơ bản, phương pháp A có một số nhược điểm, trong khi SQL lại tối ưu hơn.",
      "templateId": "frame-stat-comparison",
      "inputs": {
        "badge_top": "SO SÁNH",
        "headline": "Phương pháp A ",
        "headline_accent": "khác gì phương pháp B?",
        "left": {
          "label": "CÁCH CŨ",
          "value": "100+",
          "sub": "Lỗi phần mềm",
          "color": "#ff3333"
        },
        "right": {
          "label": "MỚI",
          "value": "0",
          "sub": "Sạch bóng lỗi",
          "color": "#34e0c0"
        },
        "badge_bottom": "Theo thống kê từ GitHub"
      }
    },
    {
      "id": "scene-3",
      "type": "body",
      "voiceText": "Điều đáng sợ là chín mươi lăm phần trăm lập trình viên vẫn mắc sai lầm này.",
      "captionText": "Điều đáng sợ là 95% lập trình viên vẫn mắc sai lầm này.",
      "templateId": "frame-alert-stat",
      "inputs": {
        "top_left": "CẢNH BÁO",
        "top_right": "NGUY HIỂM",
        "divider_text": "SỐ LIỆU ĐÁNG BÁO ĐỘNG",
        "headline": "LẬP TRÌNH VIÊN MẮC SAI LẦM",
        "badge": "LỖI BẢO MẬT",
        "stat_value": "95",
        "stat_unit": "%",
        "sub_badge": "CHỈ 5% AN TOÀN",
        "progress_percent": 95
      }
    },
    {
      "id": "scene-2",
      "type": "body",
      "voiceText": "Thực tế, rất nhiều người chưa hiểu rõ về nó.",
      "captionText": "rất nhiều người\nchưa hiểu rõ về nó.",
      "templateId": "frame-visual-body",
      "visual": {
        "searchQuery": "confused person",
        "iconQuery": "question mark"
      },
      "inputs": {
        "title": "SỰ THẬT",
        "subtitle": "Nhiều người chưa hiểu"
      }
    },
    {
      "id": "scene-4",
      "type": "outro",
      "voiceText": "Cảm ơn các bạn đã theo dõi video.",
      "captionText": "Cảm ơn các bạn đã theo dõi video.",
      "templateId": "frame-image-outro",
      "inputs": {
        "brand": "VideAuto",
        "cta": "BÌNH LUẬN NGAY ĐỂ NHẬN ƯU ĐÃI!"
      },
      "visual": {
        "imagePrompt": "Abstract glowing neon background with dark purple and cyan waves",
        "imageStyle": "3d_render",
        "iconQuery": "robot",
        "placement": "background"
      }
    }
  ]
}
`;

export async function generateScriptFromText(prompt: string): Promise<TemplateScript> {
  const cfg = loadConfig();
  if (!cfg.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey: cfg.geminiApiKey });

  // Dynamically load the catalog so AI always knows all current templates
  const catalogPath = join(process.cwd(), "templates", "CATALOG.md");
  const catalogContent = await readFile(catalogPath, "utf8");

  const fullSystemPrompt = SYSTEM_PROMPT + "\n\n" + EXAMPLE_JSON + "\n\n=== TEMPLATE CATALOG ===\n" + catalogContent;

  log.info(`Generating script from prompt: "${prompt}"...`);

  const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt,
    config: {
      systemInstruction: fullSystemPrompt,
      responseMimeType: "application/json",
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("AI returned empty response.");
  }

  try {
    const raw = JSON.parse(text);
    return TemplateScriptSchema.parse(raw);
  } catch (e) {
    log.error("AI returned invalid JSON or schema validation failed:\n" + text + "\n" + (e instanceof Error ? e.message : String(e)));
    throw new Error("Generated script is invalid. Please try a different prompt.");
  }
}
