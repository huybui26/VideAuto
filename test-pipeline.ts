import { runTemplatePipeline } from "./src/render/template-pipeline.js";
import fs from "fs";
import 'dotenv/config';

async function run() {
  const script = JSON.parse(fs.readFileSync("test-script.json", "utf-8"));
  try {
    const result = await runTemplatePipeline("tg-test", script, "test-output", () => {});
    console.log("Result:", result);
  } catch (err) {
    console.error("Error:", err);
  }
}
run();
