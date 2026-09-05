import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import pLimit from "p-limit";
import { TemplateScriptSchema, type TemplateScript } from "./template-script-schema.js";
import { loadConfig } from "../config.js";
import { createTtsClient } from "../tts/tts-client.js";
import {
  getDurationSec,
  concatWithSilence,
  mixSfxOntoVoice,
  type SfxMixSpec,
} from "../assets/audio-tools.js";
import { indexSfxLibrary, pickSfxForScene, defaultPlayback } from "../assets/sfx-selector.js";
import { pickBgmTrack, mixBgmOntoAudio } from "../assets/bgm-mixer.js";
import { composeTemplate } from "./template-composer.js";
import {
  fitClipToDuration,
  concatVideos,
  concatVideosWithTransitions,
  muxAudioOntoVideo,
  type SceneTransition,
} from "./video-tools.js";
import { 
  runTranscriber, 
  alignTimestamps, 
  generateAssSubtitles, 
  burnSubtitlesToVideo 
} from "./caption-tools.js";
import { fetchPexelsImage } from "../visual/pexels-client.js";
import { fetchIconifySvg } from "../visual/iconify-client.js";
import { fetchPollinationsImage } from "../visual/pollinations-client.js";
import { log } from "../utils/logger.js";

const TOTAL_STEPS = 10;
const SCENE_GAP_SEC = 0.3;
const OUTRO_HOLD_SEC = 3;
const RENDER_FPS = 30;

/** Maps a scene role to a key the SFX selector understands (tier-3 defaults). */
const TYPE_TO_SFX: Record<string, string> = {
  hook: "hook",
  body: "callout",
  outro: "outro",
};

/** Default transitions per scene type when none is specified in script. */
const DEFAULT_TRANSITIONS: Record<string, SceneTransition> = {
  hook: { type: "fade", durationSec: 0.5 },
  body: { type: "slideleft", durationSec: 0.4 },
  outro: { type: "fade", durationSec: 0.6 },
};

export interface PipelineResult {
  videoPath: string;
  audioPath: string;
  scriptPath: string;
  durationSec: number;
}

export async function runTemplatePipeline(
  scriptPath: string,
  onProgress?: (step: number, total: number, msg: string) => void
): Promise<PipelineResult> {
  const cfg = loadConfig();
  const outputDir = dirname(scriptPath);
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  log.info(`Output directory: ${outputDir}, timestamp: ${ts}`);

  const reportProgress = (n: number, msg: string) => {
    log.step(n, TOTAL_STEPS, msg);
    onProgress?.(n, TOTAL_STEPS, msg);
  };

  // STEP 1 — load + validate
  reportProgress(1, `Load + validate template script (TTS: ${cfg.ttsProvider})`);
  const raw = JSON.parse(await readFile(scriptPath, "utf8"));
  const script: TemplateScript = TemplateScriptSchema.parse(raw);

  // STEP 2 — script.txt for CapCut
  reportProgress(2, "Write script.txt");
  await writeFile(join(outputDir, `script_${ts}.txt`), script.scenes.map((s) => s.voiceText).join("\n\n"));

  // STEP 2.5 — Resolve Visuals (AI Visual Layer)
  reportProgress(2.5, "Resolve AI Visuals");
  const visualsDir = join(outputDir, "visuals");
  await mkdir(visualsDir, { recursive: true });
  
  for (const scene of script.scenes) {
    if (scene.visual?.imagePrompt) {
      log.info(`  scene ${scene.id}: Fetching AI Gen image for "${scene.visual.imagePrompt}"`);
      const localImagePath = await fetchPollinationsImage(scene.visual.imagePrompt, scene.visual.imageStyle, visualsDir);
      if (localImagePath) {
        const { readFileSync } = await import("node:fs");
        const ext = localImagePath.split('.').pop()?.split('?')[0] || 'jpeg';
        const mimeType = ext === 'jpg' ? 'jpeg' : ext;
        const base64 = readFileSync(localImagePath, "base64");
        scene.inputs.imageUrl = `data:image/${mimeType};base64,${base64}`;
      }
    } else if (scene.visual?.searchQuery) {
      log.info(`  scene ${scene.id}: Fetching visual photo for "${scene.visual.searchQuery}"`);
      const localImagePath = await fetchPexelsImage(scene.visual.searchQuery, visualsDir);
      if (localImagePath) {
        const { readFileSync } = await import("node:fs");
        const ext = localImagePath.split('.').pop()?.split('?')[0] || 'jpeg';
        const mimeType = ext === 'jpg' ? 'jpeg' : ext;
        const base64 = readFileSync(localImagePath, "base64");
        scene.inputs.imageUrl = `data:image/${mimeType};base64,${base64}`;
      }
    }
    
    if (scene.visual?.iconQuery) {
      log.info(`  scene ${scene.id}: Fetching icon/sticker for "${scene.visual.iconQuery}"`);
      const svgContent = await fetchIconifySvg(scene.visual.iconQuery);
      if (svgContent) {
        const base64Svg = Buffer.from(svgContent).toString("base64");
        scene.inputs.iconUrl = `data:image/svg+xml;base64,${base64Svg}`;
      }
    }
  }

  // STEP 3 — TTS each scene + ASR Timestamping (if caption enabled)
  reportProgress(3, "TTS each scene + ASR Timestamps");
  const ttsClient = createTtsClient(cfg);
  
  // Generate a stable seed per video for TTS consistency
  let ttsSeed = 0;
  const titleStr = script.metadata?.title || "video";
  for (let i = 0; i < titleStr.length; i++) {
    ttsSeed = Math.imul(31, ttsSeed) + titleStr.charCodeAt(i) | 0;
  }
  ttsSeed = Math.abs(ttsSeed);
  log.info(`  Video TTS Seed: ${ttsSeed}`);

  const TTS_PROFILES = [
    "male, moderate pitch",
    "female, moderate pitch",
    "male, low pitch",
    "female, high pitch",
  ];
  const ttsInstruct = TTS_PROFILES[ttsSeed % TTS_PROFILES.length];
  log.info(`  Video TTS Instruct Profile: ${ttsInstruct}`);

  const limit = pLimit(cfg.ttsConcurrency);
  const voiceDir = join(outputDir, "voice");
  await mkdir(voiceDir, { recursive: true });

  const sceneAudio = await Promise.all(
    script.scenes.map((scene) =>
      limit(async () => {
        const out = join(voiceDir, `scene-${scene.id}.mp3`);
        const srtOut = join(voiceDir, `scene-${scene.id}.srt`);
        const timingOut = join(voiceDir, `scene-${scene.id}-timing.json`);
        
        let dur = 0;
        if (existsSync(out)) {
          dur = await getDurationSec(out);
          log.info(`  scene ${scene.id}: REUSE mp3 (${dur.toFixed(2)}s)`);
        } else {
          log.info(`  TTS scene ${scene.id} (${scene.voiceText.length} chars)...`);
          await ttsClient.generate(scene.voiceText, out, srtOut, ttsSeed, ttsInstruct);
          dur = await getDurationSec(out);
          log.info(`  scene ${scene.id}: TTS done (${dur.toFixed(2)}s)`);
        }

        // Run ASR Timestamping if caption is requested and not already done
        if (script.caption && script.caption.style !== "none") {
          if (!existsSync(timingOut)) {
            log.info(`  ASR scene ${scene.id}: Generating word timestamps...`);
            const transcriber = await runTranscriber(out);
            const timings = alignTimestamps(scene.captionText || scene.voiceText, transcriber.chunks);
            await writeFile(timingOut, JSON.stringify(timings, null, 2), "utf8");
          }
        }

        return { id: scene.id, path: out, durationSec: dur, timingPath: timingOut };
      }),
    ),
  );

  // STEP 4 — concat voice + compute scene timings
  reportProgress(4, "Concat voice + compute timings");
  const voiceRawMp3 = join(outputDir, `voice-raw_${ts}.mp3`);
  const voiceSfxMp3 = join(outputDir, `voice-sfx_${ts}.mp3`);
  await concatWithSilence(sceneAudio.map((a) => a.path), SCENE_GAP_SEC, voiceRawMp3);

  let cursor = 0;
  const sceneStarts: Record<string, number> = {};
  for (const a of sceneAudio) {
    sceneStarts[a.id] = cursor;
    cursor += a.durationSec + SCENE_GAP_SEC;
  }

  // STEP 5 — SFX selection + mix
  reportProgress(5, "Pick + mix SFX");
  const SFX_DIR = join(outputDir, "..", "..", "assets", "sfx");
  const sfxIndex = existsSync(SFX_DIR) ? indexSfxLibrary(SFX_DIR) : {};
  const sfxList: SfxMixSpec[] = [];
  for (const scene of script.scenes) {
    const startSec = sceneStarts[scene.id];
    if (scene.sfx) {
      if (scene.sfx.name === "none") continue;
      const p = join(SFX_DIR, `${scene.sfx.name}.mp3`);
      if (existsSync(p)) sfxList.push({ path: p, startSec: startSec + scene.sfx.startOffsetSec, volume: scene.sfx.volume });
      continue;
    }
    if (Object.keys(sfxIndex).length === 0) continue;
    const picked = pickSfxForScene({
      voiceText: scene.voiceText,
      templateName: TYPE_TO_SFX[scene.type] ?? "callout",
      sceneId: scene.id,
      index: sfxIndex,
    });
    if (!picked) continue;
    const pb = defaultPlayback(picked);
    sfxList.push({ path: join(SFX_DIR, picked.relPath), startSec: startSec + pb.offsetSec, volume: pb.volume });
  }
  await mixSfxOntoVoice(voiceRawMp3, sfxList, voiceSfxMp3);
  const totalAudioSec = await getDurationSec(voiceSfxMp3);
  log.info(`  voice+sfx: ${totalAudioSec.toFixed(2)}s, ${sfxList.length} SFX`);

  // STEP 6 — Background Music (mix BGM under voice+SFX)
  reportProgress(6, "Mix background music");
  const voiceMp3 = join(outputDir, `voice_${ts}.mp3`);
  const BGM_DIR = join(outputDir, "..", "..", "assets", "bgm");
  if (script.bgm) {
    const bgmTrack = pickBgmTrack(BGM_DIR, script.bgm.mood, script.metadata.title);
    if (bgmTrack) {
      await mixBgmOntoAudio(voiceSfxMp3, bgmTrack, voiceMp3, {
        volume: script.bgm.volume ?? 0.15,
      });
      log.info(`  BGM mixed: mood=${script.bgm.mood}, vol=${script.bgm.volume ?? 0.15}`);
    } else {
      log.info(`  No BGM tracks found for mood "${script.bgm.mood}" — skipping`);
      await copyFile(voiceSfxMp3, voiceMp3);
    }
  } else {
    log.info("  No BGM configured — skipping");
    await copyFile(voiceSfxMp3, voiceMp3);
  }

  // STEP 7 — render each scene's template clip, fit to its narration length, and burn captions
  reportProgress(7, "Render template clips + fit + burn captions");
  const clipsDir = join(outputDir, "clips");
  await mkdir(clipsDir, { recursive: true });
  const lastIdx = script.scenes.length - 1;
  const fittedClips: string[] = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const durInfo = sceneAudio.find((a) => a.id === scene.id)!;
    const dur = durInfo.durationSec;
    const visualDur = dur + (i < lastIdx ? SCENE_GAP_SEC : OUTRO_HOLD_SEC);

    const rawClip = join(clipsDir, `scene-${scene.id}.mp4`);
    const fitClip = join(clipsDir, `scene-${scene.id}-fit.mp4`);
    const captionedClip = join(clipsDir, `scene-${scene.id}-captioned.mp4`);

    if (existsSync(rawClip)) {
      log.info(`  scene ${scene.id}: REUSE clip`);
    } else {
      // Merge script-level theme into scene inputs so each template can read v.__theme
      const mergedInputs = script.theme
        ? { ...scene.inputs, __theme: script.theme }
        : scene.inputs;
      await composeTemplate({
        templateId: scene.templateId,
        inputs: mergedInputs,
        aspect: script.aspect,
        outputPath: rawClip,
        fps: RENDER_FPS,
      });
    }

    if (existsSync(fitClip)) {
      log.info(`  scene ${scene.id}: REUSE fit`);
    } else {
      await fitClipToDuration(rawClip, visualDur, fitClip, RENDER_FPS);
    }

    // Burn Captions
    if (script.caption && script.caption.style !== "none") {
      if (existsSync(captionedClip)) {
        log.info(`  scene ${scene.id}: REUSE captioned`);
        fittedClips.push(captionedClip);
      } else {
        const assPath = join(clipsDir, `scene-${scene.id}.ass`);
        const timings = JSON.parse(await readFile(durInfo.timingPath, "utf8"));
        await generateAssSubtitles(timings, script.caption, assPath);
        
        log.info(`  scene ${scene.id}: Burning ${script.caption.style} captions...`);
        await burnSubtitlesToVideo(fitClip, assPath, captionedClip, RENDER_FPS);
        fittedClips.push(captionedClip);
      }
    } else {
      fittedClips.push(fitClip);
    }
  }

  // STEP 8 — concat clips with transitions
  reportProgress(8, "Concat clips + transitions");
  const silentVideo = join(outputDir, `video-silent_${ts}.mp4`);

  const hasTransitions = script.scenes.some(s => s.transition);
  if (hasTransitions) {
    const transitions: (SceneTransition | null)[] = [];
    for (let i = 0; i < script.scenes.length - 1; i++) {
      const scene = script.scenes[i];
      if (scene.transition) {
        transitions.push({
          type: scene.transition.type as SceneTransition["type"],
          durationSec: scene.transition.durationSec ?? 0.5,
        });
        log.info(`  ${scene.id} → ${scene.transition.type} (${scene.transition.durationSec ?? 0.5}s)`);
      } else {
        const def = DEFAULT_TRANSITIONS[scene.type] ?? { type: "fade", durationSec: 0.5 };
        transitions.push(def);
        log.info(`  ${scene.id} → ${def.type} (${def.durationSec}s) [default]`);
      }
    }
    await concatVideosWithTransitions(fittedClips, transitions, silentVideo, RENDER_FPS);
  } else {
    log.info("  No transitions — hard cut concat");
    await concatVideos(fittedClips, silentVideo);
  }

  // STEP 9 — mux audio onto video
  reportProgress(9, "Mux audio onto video");
  const videoPath = join(outputDir, `video_${ts}.mp4`);
  await muxAudioOntoVideo(silentVideo, voiceMp3, videoPath);

  // STEP 10 — done
  reportProgress(10, "Done");
  console.log("\n=== Result ===");
  console.log(`Video:  ${videoPath}`);
  console.log(`Audio:  ${voiceMp3}  (cho CapCut)`);
  console.log(`Script: ${join(outputDir, `script_${ts}.txt`)}  (cho CapCut auto-caption)`);
  console.log(`Tong thoi luong: ${totalAudioSec.toFixed(2)}s`);

  return {
    videoPath,
    audioPath: voiceMp3,
    scriptPath: join(outputDir, `script_${ts}.txt`),
    durationSec: totalAudioSec
  };
}

/** Simple file copy helper */
async function copyFile(src: string, dest: string): Promise<void> {
  const { copyFile: cp } = await import("node:fs/promises");
  await cp(src, dest);
}
