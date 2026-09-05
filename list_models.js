import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.list();
  for await (const model of response) {
    console.log(model.name, model.supportedActions);
  }
}
main().catch(console.error);
