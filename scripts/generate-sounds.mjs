/**
 * generate-sounds.mjs
 * Genera los 6 efectos de sonido de Kibbo usando la ElevenLabs Sound Effects API
 * y los guarda como MP3 en public/sounds/.
 *
 * Uso:
 *   ELEVENLABS_API_KEY=sk_... node scripts/generate-sounds.mjs
 *
 * Requiere Node 18+ (fetch nativo).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/sounds");

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("❌  Falta ELEVENLABS_API_KEY en el entorno.");
  console.error("    Ejecuta: ELEVENLABS_API_KEY=sk_... node scripts/generate-sounds.mjs");
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

/** Definición de cada sonido */
const SOUNDS = [
  {
    key: "correct",
    file: "correct.mp3",
    duration: 0.8,
    prompt_influence: 0.4,
    text: "A bright cheerful two-note ascending chime, C5 then E5, sparkly bell tone, positive correct answer sound for a learning app, short and satisfying, clean and musical",
  },
  {
    key: "wrong",
    file: "wrong.mp3",
    duration: 0.6,
    prompt_influence: 0.4,
    text: "A soft gentle double low thud, two descending muted tones, wrong answer feedback for a learning app, non-harsh and brief, warm not punishing",
  },
  {
    key: "xp",
    file: "xp.mp3",
    duration: 0.9,
    prompt_influence: 0.35,
    text: "A bright sparkling three-note ascending arpeggio chime, C5 E5 G5, game XP points earned sound, rewarding and crisp, triumphant mini fanfare",
  },
  {
    key: "moduleComplete",
    file: "module-complete.mp3",
    duration: 2.2,
    prompt_influence: 0.45,
    text: "A grand triumphant fanfare, five ascending notes C5 E5 G5 C6 E6 followed by a full sustained C major chord, celebratory game level or module completion sound, rich orchestral tone, rewarding",
  },
  {
    key: "quizPass",
    file: "quiz-pass.mp3",
    duration: 1.0,
    prompt_influence: 0.4,
    text: "A warm pleasant three-note ascending musical tone, bright and positive quiz passed sound for a learning game, encouraging and clean, gentle fanfare",
  },
  {
    key: "quizFail",
    file: "quiz-fail.mp3",
    duration: 0.9,
    prompt_influence: 0.4,
    text: "A soft three-note descending resolution E4 D4 C4, gentle quiz failed sound for a learning app, not harsh, warm and encouraging to try again",
  },
];

async function generateSound(sound) {
  const outPath = path.join(OUT_DIR, sound.file);

  console.log(`⏳  Generando "${sound.key}"...`);

  const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: sound.text,
      duration_seconds: sound.duration,
      prompt_influence: sound.prompt_influence,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} para "${sound.key}": ${body}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outPath, Buffer.from(buffer));

  const kb = (buffer.byteLength / 1024).toFixed(1);
  console.log(`✅  "${sound.key}" guardado → ${sound.file} (${kb} KB)`);
}

async function main() {
  console.log(`\n🎵  Kibbo Sound Generator — ElevenLabs Sound Effects API`);
  console.log(`📁  Destino: ${OUT_DIR}\n`);

  const errors = [];

  // Generamos secuencialmente para no saturar la API
  for (const sound of SOUNDS) {
    try {
      await generateSound(sound);
      // Pausa corta entre llamadas
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      console.error(`❌  Error en "${sound.key}":`, err.message);
      errors.push(sound.key);
    }
  }

  console.log("\n─────────────────────────────────────────");
  if (errors.length === 0) {
    console.log("🎉  Todos los sonidos generados correctamente.");
    console.log("    El audioEngine los cargará automáticamente al iniciar la app.");
  } else {
    console.log(`⚠️   ${errors.length} sonido(s) fallaron: ${errors.join(", ")}`);
    console.log("    El audioEngine usará síntesis procedural para los que fallen.");
    process.exit(1);
  }
}

main();
