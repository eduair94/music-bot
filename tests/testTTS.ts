import "dotenv/config";
import fs from "fs";
import { ttsService } from "../services/tts";

/**
 * Manual test for the TTS service (run with: npm run test:tts)
 * Generates speech via the configured provider and verifies the output file.
 */
(async () => {
  ttsService.initialize();

  if (!ttsService.isAvailable()) {
    console.error("❌ TTS service not available. Set GEMINI_API_KEY or REPLICATE_API_TOKEN.");
    process.exit(1);
  }

  const result = await ttsService.generateSpeech({
    text: "Hola, esto es una prueba del comando say usando Google.",
  });

  console.log("Result:", result);

  if (result.url.startsWith("http")) {
    console.log("✅ Remote URL returned (Replicate provider)");
    return;
  }

  const buf = fs.readFileSync(result.url);
  const header = buf.subarray(0, 4).toString("ascii");
  console.log(`File: ${result.url} | size: ${buf.length} bytes | header: ${header}`);

  if (header !== "RIFF" || buf.length < 1000) {
    console.error("❌ Output is not a valid WAV file");
    process.exit(1);
  }

  console.log("✅ Valid WAV file generated");
})().catch((e) => {
  console.error("❌ FAILED:", e?.response?.data || e);
  process.exit(1);
});
