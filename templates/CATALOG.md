# Template Catalog (HyperFrames, renderer: "hyperframes")

Each scene in a template-mode `script.json` names a `templateId` below and fills
`inputs` with the listed slots. The template owns all visual design; you only
write text. Keep text SHORT — these are poster layouts, not paragraphs.

Render aspect is set once per script (`"aspect": "9:16"` for TikTok/Shorts).

> Vietnamese: visual text (inputs) keeps normal formatting ("5.5", "82.7%").
> Only `voiceText` must spell numbers out phonetically (see the skill rules).
> Emoji/icons (🔥 🚀 → …) are allowed in on-screen `inputs` (they render in colour),
> but NEVER in `voiceText`. Don't put emoji in char-by-char animated fields
> (e.g. `hero` of build-minimal).

## 🎨 Theme System
You **must** include a `theme` object at the root level of your JSON (alongside `metadata` and `scenes`) to set the visual mood of the ENTIRE video based on its topic.
The templates will automatically apply these colors via CSS variables (`--bg-primary`, etc.).

**Example theme configurations based on topic:**
- **Tech / AI:** `{"bgPrimary":"#020c1a","bgSecondary":"#0a1628","textPrimary":"#fafaf8","textSecondary":"rgba(250,250,248,0.55)","accent1":"#5ce1e6","accent2":"#38bdf8","blob1":"#1565c0","blob2":"#0d47a1","blob3":"#1976d2","mood":"dark"}`
- **Dating / Love:** `{"bgPrimary":"#fff0f3","bgSecondary":"#ffe5ec","textPrimary":"#1c1410","textSecondary":"rgba(28,20,16,0.6)","accent1":"#ff4d6d","accent2":"#ff8fa3","blob1":"#ffccd5","blob2":"#ffb3c1","blob3":"#ff8fa3","mood":"light"}`
- **Finance / Crypto:** `{"bgPrimary":"#022c22","bgSecondary":"#064e3b","textPrimary":"#f0fdf4","textSecondary":"rgba(240,253,244,0.6)","accent1":"#10b981","accent2":"#34d399","blob1":"#065f46","blob2":"#047857","blob3":"#059669","mood":"dark"}`
- **Food / Cooking:** `{"bgPrimary":"#fffbeb","bgSecondary":"#fef3c7","textPrimary":"#451a03","textSecondary":"rgba(69,26,3,0.6)","accent1":"#f59e0b","accent2":"#fbbf24","blob1":"#fde68a","blob2":"#fcd34d","blob3":"#fbbf24","mood":"light"}`

Make sure to align `mood` (`"dark"` or `"light"`) with the background colors so templates can adjust their internal borders/shadows correctly.

---

## frame-bold-poster

**Role:** hook / strong statement. 1970s editorial poster — giant red figure,
3-line tilted headline (middle line auto-red), serif standfirst.
**Best for:** the opening hook, or a punchy single-claim body beat.

| slot           | type     | limit                    | notes                                                |
| -------------- | -------- | ------------------------ | ---------------------------------------------------- |
| `kicker`       | string   | ≤24                      | small uppercase label, top-left (e.g. "VideAuto")   |
| `date`         | string   | ≤24                      | top-right metadata (e.g. "12 · 06 · 2026")           |
| `figure`       | string   | ≤4                       | giant red figure — a number/stat (e.g. "5.5", "200") |
| `headline`     | string[] | ≤3 lines, ≤14 chars/line | line 2 renders red                                   |
| `standfirst`   | string   | ≤160                     | italic serif sub-line                                |
| `footer_left`  | string   | ≤32                      | channel name                                         |
| `footer_right` | string   | ≤32                      | source domain (renders red)                          |

---

## frame-statement-outro

**Role:** outro / closing CTA. Paper card: red rule, CTA, giant red channel
name, muted source, ink rule.
**Best for:** the final scene (always `type: "outro"`).

| slot      | type   | limit | notes                                                                  |
| --------- | ------ | ----- | ---------------------------------------------------------------------- |
| `cta`     | string | ≤60   | uppercase call-to-action (e.g. "Theo dõi để xem bản tin mới mỗi ngày") |
| `channel` | string | ≤24   | channel name (giant red)                                               |
| `source`  | string | ≤40   | "Nguồn: <domain>"                                                      |

---

## frame-image-hero

**Role:** hook / visual body. Similar layout to bold-poster but features a dynamic background image fetched via the AI Visual Layer. The image slowly zooms in under a dark overlay.
**Best for:** setting the scene visually with an actual photo (e.g. a gym, a hacker, a business meeting).

| slot           | type     | limit                    | notes                                                |
| -------------- | -------- | ------------------------ | ---------------------------------------------------- |
| `kicker`       | string   | ≤24                      | small uppercase label, top-left                      |
| `date`         | string   | ≤24                      | top-right metadata                                   |
| `figure`       | string   | ≤4                       | giant red figure — a number/stat                     |
| `headline`     | string[] | ≤3 lines, ≤14 chars/line | line 2 renders red                                   |
| `standfirst`   | string   | ≤160                     | italic serif sub-line                                |
| `footer_left`  | string   | ≤32                      | channel name                                         |
| `footer_right` | string   | ≤32                      | source domain (renders red)                          |

*Required Visual:* Set `visual.searchQuery` in the scene (e.g. "gym workout", "hacker coding") with `placement: "background"`.

---

## frame-visual-body

**Role:** body. A simple, elegant layout that features a background image and a prominent bouncing SVG sticker/emoji in the center, alongside a simple title and subtitle.
**Best for:** explaining a concept visually using an icon or emoji.

| slot           | type     | limit                    | notes                                                |
| -------------- | -------- | ------------------------ | ---------------------------------------------------- |
| `title`        | string   | ≤32                      | prominent title                                      |
| `subtitle`     | string   | ≤64                      | italic subtitle                                      |

*Required Visual:* Set `visual.searchQuery` (background photo) AND `visual.iconQuery` (floating SVG sticker/emoji).

---

## frame-alert-stat

**Role:** body / urgent stat. A dramatic high-contrast "News Flash" style canvas
(`#000000` pitch black) — huge red numbers, top layout line, red warning badges,
and a progress bar.
**Best for:** displaying a single shocking statistic, warning, or urgent news beat.

| slot               | type   | limit | notes                                                          |
| ------------------ | ------ | ----- | -------------------------------------------------------------- |
| `top_left`         | string | ≤40   | top left gray label (e.g. "UET - CÔNG NGHỆ THÔNG TIN")         |
| `top_right`        | string | ≤12   | top right giant red number (e.g. "-3,19")                      |
| `divider_text`     | string | ≤30   | text next to red line (e.g. "NGAY TRONG HÔM NAY")              |
| `headline`         | string | ≤60   | giant white bold text (e.g. "HỌC VIỆN CÔNG NGHỆ...")           |
| `badge`            | string | ≤20   | red warning pill badge (e.g. "PTIT")                           |
| `stat_value`       | string | ≤6    | massive red statistic number (e.g. "23")                       |
| `stat_unit`        | string | ≤20   | unit next to stat_value (e.g. "ĐIỂM")                          |
| `sub_badge`        | string | ≤40   | second red pill badge under stat (e.g. "CHỈ CÒN ĐÚNG 23 ĐIỂM") |
| `progress_percent` | number | 0-100 | fills the red striped progress bar at bottom                   |

---

## frame-build-minimal

**Role:** body / bold statement. Dark cinematic canvas (`#0b0a09` + a warm amber
ambient glow) — one **big bold word** revealed letter-by-letter (glowing warm
white), an amber eyebrow, an amber hairline, a two-line description, rotated side
labels.
**Best for:** a punchy single-concept beat (a verdict, a theme, a turning point)
with a premium dark/amber look.

| slot         | type   | limit | notes                                                         |
| ------------ | ------ | ----- | ------------------------------------------------------------- |
| `eyebrow`    | string | ≤20   | small uppercase label above the word                          |
| `hero`       | string | ≤10   | ONE short word/phrase (revealed char-by-char — keep it short) |
| `desc`       | string | ≤90   | one supporting sentence below                                 |
| `side_left`  | string | ≤20   | rotated label on the left edge (e.g. channel)                 |
| `side_right` | string | ≤20   | rotated label on the right edge                               |

---

## frame-vignelli

**Role:** body / bold stat hero. Massimo Vignelli editorial — **dark charcoal**
canvas, a single red accent column on the right, 6-column grid, a giant white
number, uppercase label, footer wordmark with red underline.
**Best for:** a striking single statistic when you want a dark, high-contrast
beat (variety vs the white/paper templates).

| slot     | type   | limit | notes                                                            |
| -------- | ------ | ----- | ---------------------------------------------------------------- |
| `kicker` | string | ≤30   | small uppercase label next to a red bar (e.g. "Khảo sát · 2026") |
| `number` | string | ≤6    | the giant white stat (e.g. "62%", "3/4", "1M")                   |
| `label`  | string | ≤40   | uppercase white label under the number (≤2 short lines)          |
| `note`   | string | ≤120  | one muted supporting sentence                                    |
| `brand`  | string | ≤24   | footer wordmark (channel name)                                   |

---

## frame-image-outro

**Role:** outro / brand end-card (**default outro**). A clean, modern closing card featuring a background image, an optional sticker/emoji, a large brand name, and a call-to-action (CTA).
**Best for:** the final scene (`type: "outro"`) — a polished brand sign-off with visual context.

| slot          | type   | limit | notes                                                       |
| ------------- | ------ | ----- | ----------------------------------------------------------- |
| `brand`       | string | ≤60   | channel/brand name (big, prominent)                         |
| `cta`         | string | ≤120  | call to action under the name (e.g. "BÌNH LUẬN ĐỂ NHẬN ƯU ĐÃI") |

*Required Visual:* Set `visual.searchQuery` (background photo) AND optional `visual.iconQuery` (floating SVG sticker/emoji).

---

## frame-liquid-bg-hero

**Role:** hook / hero (**default hook**). "Aurora Violet" — deep-indigo canvas
with large soft floating colour blobs + faint grid; a centred white headline,
subheadline and a rounded CTA pill.
**Best for:** the opening hook (`type: "hook"`) — a modern, premium intro.

| slot          | type   | limit | notes                                              |
| ------------- | ------ | ----- | -------------------------------------------------- |
| `kicker`        | string | ≤24  | small uppercase label, top-left (e.g. "VideAuto")             |
| `headline`      | string | ≤60  | the hook line (keep punchy, ~2 short lines) — shown in a vivid gradient |
| `headline_from` | string | hex  | headline gradient start (optional; default vivid gold→purple) |
| `headline_to`   | string | hex  | headline gradient end (optional)                              |
| `subheadline`   | string | ≤120 | one supporting sentence                                       |
| `cta`           | string | ≤24  | rounded pill label (e.g. "Theo dõi ngay")                    |
| `brand`         | string | ≤24  | footer-left label (channel/source)                           |

> Headline renders in an eye-catching gradient (default gold→orange→pink→purple).
> Override with `headline_from`/`headline_to` to fit the tone if you want.

---

## frame-creative-voltage
**Role:** hook / creative statement (alternative). Electric split — an electric-
blue panel (mono meta + a handwritten script accent + hand-drawn underline) and
a dark panel with a stacked display title, one line outlined in electric blue.
Bold, energetic, design-forward.
**Best for:** a punchy hook or a strong creative body statement (a few short words).

| slot            | type     | limit            | notes                                                            |
| --------------- | -------- | ---------------- | ---------------------------------------------------------------- |
| `meta`          | string   | ≤40              | mono label on the blue panel (e.g. "// CHE_DO_SANG_TAO · ON")    |
| `display_lines` | string[] | ≤4 lines, short  | the big title, one line per word/phrase                          |
| `accent_index`  | number   | 0-based          | which `display_lines` line gets the electric blue outline (default 1) |
| `script`        | string   | ≤20              | handwritten accent on the blue panel (Dancing Script)            |
| `caption`       | string   | ≤60              | mono caption, bottom-right                                       |

---

## frame-glitch-title
**Role:** hook / cyberpunk glitch (alternative). Dark signal-noise canvas —
scanlines, grid, grain, vignette, mono "REC"/timecode chrome, and a big title
with a cyan×magenta RGB-split glitch. High-energy, edgy.
**Best for:** a dramatic/breaking or tech hook (a short shouty title).

| slot       | type   | limit | notes                                                  |
| ---------- | ------ | ----- | ------------------------------------------------------ |
| `title`    | string | ≤40   | the big glitch title (short; uppercased automatically) |
| `subtitle` | string | ≤80   | mono line under the title                              |

---

## frame-aicoding-list
**Role:** body / list · comparison (original). Dark canvas with a warm gradient
glow, a big gradient-accent title + subtitle, then a stack of rounded item cards
— each with a coloured icon chip, title + description, and a coloured level tag.
**Best for:** any scene that is a **list / ranking / comparison of 2–5 items**
(who's affected, pros vs cons, tiers, a checklist).

| slot       | type     | limit       | notes                                                        |
| ---------- | -------- | ----------- | ------------------------------------------------------------ |
| `title`       | string   | ≤40       | big headline (text before the accent)                          |
| `accent`      | string   | ≤20       | trailing word shown in a gradient (optional)                   |
| `accent_from` | string   | hex       | gradient start colour for `accent` (optional; default `#ff9a3d`) |
| `accent_to`   | string   | hex       | gradient end colour for `accent` (optional; default `#ff2d55`)   |
| `subtitle`    | string   | ≤60       | muted line under the title                                     |
| `items`       | object[] | 2–5 items | each: `{ icon, title, desc, tag, level }`                      |

Each `items[]` entry:
- `icon` — **you choose** an emoji that fits the item (🚫 ⚠️ ✅ 🔴 📈 ❌ 💡 🔒 🚀 …), shown in a tinted chip. Not fixed.
- `title` — bold item name (≤24). `desc` — small muted line (≤40).
- `tag` — short right-hand label (≤6, e.g. "Nguy", "Cao", "Lợi").
- `level` — `danger` (red) · `warn` (amber) · `good` (green) · `info` (blue); sets the icon/tag/bar colour.

> The accent gradient colours (`accent_from`/`accent_to`) are free to choose to fit the tone
> (e.g. warm `#ff9a3d`→`#ff2d55`, cool `#7c5cff`→`#22d3ee`, green `#34d399`→`#22c55e`).

---

## frame-stat-comparison
**Role:** body / head-to-head comparison. A sleek dual-card UI on a dark navy grid.
Features a top pill badge, a headline, two neon-glowing cards side-by-side with massive
numbers, and a footer badge.
**Best for:** comparing **two stats, prices, or versions** (old vs new, Option A vs B).

| slot            | type   | limit | notes                                                            |
| --------------- | ------ | ----- | ---------------------------------------------------------------- |
| `badge_top`     | string | ≤30   | pill label at top (e.g. "PROMPT CACHING")                        |
| `headline`      | string | ≤40   | first part of the headline (white text)                          |
| `headline_accent`| string | ≤30   | second part of the headline (cyan text)                          |
| `left`          | object | —     | left side card (see below)                                       |
| `right`         | object | —     | right side card (see below)                                      |
| `badge_bottom`  | string | ≤60   | pill label at bottom (e.g. "giá tham khảo Claude Opus 5...")     |

Each side (`left` / `right`) object:
- `label` — top title of the card (e.g. "LẦN 1").
- `value` — the massive stat/number (e.g. "$5.00").
- `sub` — small gray text at bottom of card (e.g. "/1M tính đầy đủ").
- `color` — neon glow hex color (e.g. "#34e0c0" for left, "#9b51e0" for right).

---

## frame-gradient-quote
**Role:** body / quote / wisdom. Glassmorphism card floating over an animated
gradient background with floating colour orbs. A large quote mark, big quote
text, a gradient divider, and an author line — all inside a frosted-glass card.
**Best for:** viral quotes, strong opinions, wisdom, "did you know" moments,
philosophical takes — when the scene is a single powerful sentence.

| slot     | type   | limit | notes                                                          |
| -------- | ------ | ----- | -------------------------------------------------------------- |
| `quote`  | string | ≤120  | the main quote text (big, prominent)                           |
| `author` | string | ≤40   | source / attribution (e.g. "— Elon Musk", "— Khuyết danh")    |
| `tag`    | string | ≤24   | optional pill badge above the card (e.g. "💡 Bài học", "🔥 Hot") |

---

## frame-split-reveal
**Role:** body / visual comparison. Split-screen with two contrasting colour
panels that slide in from left and right, a vertical divider line, and a
central "VS" badge. Each panel has an icon + large text.
**Best for:** before/after, đúng/sai, pros/cons, old vs new — a **visual**
comparison that doesn't require numbers (unlike stat-comparison).

| slot           | type   | limit | notes                                       |
| -------------- | ------ | ----- | ------------------------------------------- |
| `left_label`   | string | ≤12   | label for left panel (e.g. "TRƯỚC")          |
| `left_text`    | string | ≤40   | main text on left                            |
| `left_icon`    | string | ≤4    | emoji for left side (e.g. "⏳")              |
| `right_label`  | string | ≤12   | label for right panel (e.g. "SAU")           |
| `right_text`   | string | ≤40   | main text on right                           |
| `right_icon`   | string | ≤4    | emoji for right side (e.g. "🚀")             |
| `divider_text` | string | ≤6    | text in centre badge (default "VS")          |

> Left panel uses `accent-1`, right panel uses `accent-2` from the theme.

---

## frame-neon-callout
**Role:** body / callout card. Dark canvas with a subtle grid and ambient
glow orbs. A card with a neon-glowing pulsating border (accent-1 → accent-2),
a large icon, gradient title, body text, and a footer tag.
**Best for:** highlighting a single key point, tip, "did you know", warning,
or insight — when you don't have hard numbers (use instead of alert-stat).

| slot     | type   | limit | notes                                             |
| -------- | ------ | ----- | ------------------------------------------------- |
| `icon`   | string | ≤4    | large emoji (e.g. "💡", "⚠️", "🔥")                |
| `title`  | string | ≤40   | gradient headline                                 |
| `body`   | string | ≤160  | supporting body text                              |
| `footer` | string | ≤40   | optional small uppercase tag (e.g. "KIẾN THỨC LÀ SỨC MẠNH") |

---

## frame-timeline-step
**Role:** body / process / steps. Dark canvas with a vertical timeline
(animated line + glowing dots) and step cards that fade in sequentially.
Each step has a label, description, and status badge (done/active/pending).
**Best for:** step-by-step guides, processes, roadmaps, "3 bước để...",
chronological stories — any scene describing a sequence.

| slot     | type     | limit      | notes                                      |
| -------- | -------- | ---------- | ------------------------------------------ |
| `title`  | string   | ≤50        | section title                              |
| `kicker` | string   | ≤24        | small uppercase label above title           |
| `steps`  | object[] | 2–4 items  | each: `{ label, desc, status }`            |

Each `steps[]` entry:
- `label` — step title (e.g. "Bước 1", ≤20).
- `desc` — step description (≤60).
- `status` — `done` (green) · `active` (pulse glow) · `pending` (muted).

---

## frame-magazine-feature
**Role:** body / visual feature. Full-bleed background image (via AI Visual
Layer) with a cinematic gradient overlay. Text is stacked at the bottom in a
premium magazine-style layout with serif headline (Playfair Display), an
accent kicker tag, a pull-quote with a left border, and a credit line.
**Best for:** introducing a topic visually, product reviews, lifestyle stories,
travel — when you want a **premium editorial** look with a big photo.

| slot         | type   | limit | notes                                           |
| ------------ | ------ | ----- | ----------------------------------------------- |
| `kicker`     | string | ≤16   | accent tag (e.g. "REVIEW", "TRENDING")           |
| `headline`   | string | ≤60   | big serif headline                               |
| `pull_quote` | string | ≤120  | italic pull-quote (serif, left-bordered)         |
| `credit`     | string | ≤40   | credit/source line                               |

*Required Visual:* Set `visual.imagePrompt` or `visual.searchQuery` for the full-bleed background image.

---

## frame-glass-hero

**Role:** hook / modern intro. Frosted-glass card floating over an animated mesh
gradient — the cleanest of the hooks.
**Best for:** a tech/product opening when `frame-liquid-bg-hero` feels too loud.

| slot       | type   | limit | notes                                              |
| ---------- | ------ | ----- | -------------------------------------------------- |
| `kicker`   | string | ≤24   | small uppercase label above the headline           |
| `headline` | string | ≤40   | main title inside the glass card                   |
| `subtitle` | string | ≤80   | one supporting line under the headline             |
| `brand`    | string | ≤24   | channel/brand name at the bottom                   |

---

## frame-pentagram-stat

**Role:** body / hero number. Swiss-grid layout on a dark neon ground — glowing
orange figure plus a cyan accent bar chart.
**Best for:** a single benchmark or headline number (pairs well alternating with
`frame-vignelli` so number-heavy videos don't look repetitive).

| slot           | type   | limit | notes                                                  |
| -------------- | ------ | ----- | ------------------------------------------------------ |
| `label`        | string | ≤24   | small uppercase label above the figure                 |
| `headline`     | string | ≤6    | the number itself (e.g. "200MP", "82.7%")              |
| `subtitle`     | string | ≤80   | one line explaining the number                         |
| `anchor`       | string | ≤6    | value the bar chart scales against (e.g. "200")        |
| `footer_left`  | string | ≤24   | bottom-left metadata (channel)                         |
| `footer_right` | string | ≤40   | bottom-right metadata (source/url)                     |

---

## frame-aicoding-comparison

**Role:** body / head-to-head. Two gradient-framed cards with a `pre VS post`
title, optional WIN badge and a stat strip underneath.
**Best for:** exactly two things — old vs new, A vs B, before/after.

| slot    | type   | limit | notes                                                   |
| ------- | ------ | ----- | ------------------------------------------------------- |
| `badge` | string | ≤24   | small pill above the title                              |
| `pre`   | string | ≤24   | title text before the VS mark                           |
| `vs`    | string | ≤8    | the divider mark itself (e.g. "VS")                     |
| `post`  | string | ≤24   | title text after the VS mark                            |
| `left`  | object | —     | left card (see below)                                   |
| `right` | object | —     | right card (see below)                                  |

Each side is `{ label, from, to, icon?, bullets[], stat?, stat_label?, win? }`:

| key          | type     | notes                                                            |
| ------------ | -------- | ---------------------------------------------------------------- |
| `label`      | string   | card title, rendered with the gradient                           |
| `from`, `to` | hex      | gradient pair for that side (defaults: left orange, right teal)   |
| `icon`       | string   | optional emoji at the top of the card                            |
| `bullets`    | string[] | 2–4 short lines                                                  |
| `stat`       | string   | optional figure in the stat strip                                |
| `stat_label` | string   | label under that figure                                          |
| `win`        | bool\|str | `true` (or custom text) → glowing border + WIN badge             |

---

## frame-bento-body

**Role:** body / Apple-style bento grid. One hero stat plus two small icon boxes.
**Best for:** a stat that needs two short supporting facts beside it.

| slot         | type   | limit | notes                                        |
| ------------ | ------ | ----- | -------------------------------------------- |
| `hero_stat`  | string | ≤6    | the big number in the hero cell              |
| `stat_label` | string | ≤40   | label under the hero number                  |
| `box1_icon`  | string | ≤2    | emoji for the first small box                |
| `box1_text`  | string | ≤40   | one short line in the first box              |
| `box2_icon`  | string | ≤2    | emoji for the second small box               |
| `box2_text`  | string | ≤40   | one short line in the second box             |

---

## Adding a template

Drop a folder `templates/<id>/` with `index.html` (16:9 root, `data-composition-id`),
`compositions/portrait.html` (9:16), `hyperframes.json`, `meta.json`, and a
`NOTICE.md` if vendored. Use a Vietnamese-capable font stack (Alfa Slab One /
Lora / Be Vietnam Pro are known-good). Then add a row here.
