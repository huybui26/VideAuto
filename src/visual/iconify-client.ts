import axios from "axios";
import { log } from "../utils/logger.js";

interface IconifySearchResponse {
    icons: string[];
    total: number;
}

/**
 * Searches Iconify for an icon and returns its raw SVG string.
 * It prioritizes colored emoji sets for a "sticker" look (fluent-emoji, noto).
 */
export async function fetchIconifySvg(query: string): Promise<string | null> {
    try {
        log.info(`Searching Iconify for sticker: "${query}"...`);
        // We limit to prefixes that are high-quality full-color emojis/stickers.
        const searchUrl = `https://api.iconify.design/search?query=${encodeURIComponent(query)}&prefixes=fluent-emoji,noto,twemoji&limit=1`;
        
        const searchResp = await axios.get<IconifySearchResponse>(searchUrl, { timeout: 10000 });
        
        let iconName = "";
        if (searchResp.data.icons && searchResp.data.icons.length > 0) {
            iconName = searchResp.data.icons[0];
        } else {
            // Fallback: search across all flat icons if no sticker found
            log.info(`No sticker found for "${query}", falling back to generic flat icons.`);
            const fallbackUrl = `https://api.iconify.design/search?query=${encodeURIComponent(query)}&limit=1`;
            const fallbackResp = await axios.get<IconifySearchResponse>(fallbackUrl, { timeout: 10000 });
            if (fallbackResp.data.icons && fallbackResp.data.icons.length > 0) {
                iconName = fallbackResp.data.icons[0];
            }
        }

        if (!iconName) {
            log.warn(`No icon found for query: "${query}"`);
            return null;
        }

        // iconName is like "fluent-emoji:rocket". The SVG URL is: /fluent-emoji/rocket.svg
        const [prefix, name] = iconName.split(':');
        const svgUrl = `https://api.iconify.design/${prefix}/${name}.svg`;
        
        log.info(`Downloading SVG sticker from ${svgUrl}`);
        const svgResp = await axios.get(svgUrl, { responseType: 'text', timeout: 10000 });
        
        return svgResp.data;
    } catch (err: any) {
        log.error(`Iconify fetch failed for "${query}": ${err.message}`);
        return null;
    }
}
