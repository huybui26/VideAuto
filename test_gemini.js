import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: 'hello',
  });
  console.log(response.text);
}
main().catch(console.error);
