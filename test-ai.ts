import { generateScriptFromText } from "./src/bot/ai-generator.js";
import { loadConfig } from "./src/config.js";
import 'dotenv/config';
async function run() {
  const script = await generateScriptFromText("Tạo cho tôi 1 video về sự quan trọng của các thực phẩm giàu chất xơ trong bữa ăn hằng ngày");
  console.log(JSON.stringify(script, null, 2));
}
run();
