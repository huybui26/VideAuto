import axios from "axios";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { log } from "../utils/logger.js";
import { loadConfig } from "../config.js";

interface PexelsPhoto {
    id: number;
    src: {
        original: string;
        large2x: string;
        large: string;
        medium: string;
        small: string;
        portrait: string;
        landscape: string;
        tiny: string;
    };
    alt: string;
}

interface PexelsResponse {
    photos: PexelsPhoto[];
}

export async function fetchPexelsImage(query: string, outputDir: string): Promise<string | null> {
    const config = loadConfig();
    if (!config.pexelsApiKey) {
        log.warn("PEXELS_API_KEY is not set. Visual layers will be skipped.");
        return null;
    }

    try {
        log.info(`Searching Pexels for: "${query}"...`);
        const resp = await axios.get<PexelsResponse>("https://api.pexels.com/v1/search", {
            headers: {
                Authorization: config.pexelsApiKey
            },
            params: {
                query,
                per_page: 5,
                orientation: "portrait"
            },
            timeout: 10000
        });

        if (!resp.data.photos || resp.data.photos.length === 0) {
            log.warn(`No Pexels photos found for query: "${query}"`);
            return null;
        }

        // Pick the first photo
        const photo = resp.data.photos[0];
        // Use original for best quality on 1080x1920, fallback to large2x
        const imageUrl = photo.src.original || photo.src.large2x || photo.src.portrait;
        
        await mkdir(outputDir, { recursive: true });
        
        // Cache name based on photo ID to avoid redownloading
        const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
        const filename = `pexels-${photo.id}.${ext}`;
        const localPath = join(outputDir, filename);

        if (existsSync(localPath)) {
            log.info(`Using cached Pexels image: ${localPath}`);
            return localPath;
        }

        log.info(`Downloading Pexels image to ${localPath}...`);
        const dlResp = await axios.get(imageUrl, { responseType: 'stream', timeout: 30000 });
        await pipeline(dlResp.data, createWriteStream(localPath));

        return localPath;
    } catch (err: any) {
        log.error(`Pexels fetch failed for "${query}": ${err.message}`);
        return null;
    }
}
