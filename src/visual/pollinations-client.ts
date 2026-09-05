import { log } from "../utils/logger.js";
import { join } from "path";
import { writeFile } from "fs/promises";
import { randomUUID } from "crypto";

/**
 * Fetch an AI-generated image from Pollinations.ai based on a text prompt.
 * 
 * @param prompt The English prompt for the image.
 * @param style Optional style suffix to append to the prompt (e.g. "photorealistic", "anime").
 * @param outDir Directory to save the image.
 * @returns The absolute path to the downloaded image, or null if failed.
 */
export async function fetchPollinationsImage(
    prompt: string,
    style: string | undefined,
    outDir: string
): Promise<string | null> {
    try {
        let finalPrompt = prompt;
        if (style) {
            // Append the requested style to the prompt for better adherence
            finalPrompt += `, in ${style.replace("_", " ")} style, highly detailed, 8k resolution, masterpiece`;
        } else {
            finalPrompt += `, highly detailed, 8k resolution, masterpiece`;
        }

        // Pollinations.ai uses simple GET requests to generate and return the image.
        // width=1080&height=1920 enforces the 9:16 portrait aspect ratio.
        // nologo=true removes the watermark.
        const encodedPrompt = encodeURIComponent(finalPrompt.trim());
        const seed = Math.floor(Math.random() * 1000000);
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1920&nologo=true&seed=${seed}`;

        log.info(`[Pollinations] Generating AI image for prompt: "${prompt.substring(0, 50)}..."`);
        
        const response = await fetch(url);
        if (!response.ok) {
            log.error(`[Pollinations] Failed to fetch image. Status: ${response.status}`);
            return null;
        }

        const buffer = await response.arrayBuffer();
        const fileName = `ai_gen_${randomUUID().substring(0, 8)}.jpg`;
        const filePath = join(outDir, fileName);

        await writeFile(filePath, Buffer.from(buffer));
        log.info(`[Pollinations] Saved generated image to: ${filePath}`);
        
        return filePath;
    } catch (e) {
        log.error(`[Pollinations] Error fetching generated image: ${e instanceof Error ? e.message : String(e)}`);
        return null;
    }
}
