/**
 * Fill every locale file with the keys it is missing, translated from
 * locales/en.json by Claude. Existing translations are never overwritten.
 *
 *   node scripts/translateLocales.mjs            # all locales
 *   node scripts/translateLocales.mjs es pt_br   # some locales
 *   node scripts/translateLocales.mjs --dry      # count what's missing, no API calls
 *
 * API keys come from C:\Users\airau\.secrets\claude-credit-keys.env (plan
 * credit keys, rotated on "credit balance too low"), or ANTHROPIC_API_KEY.
 * Keys are read into memory only and never printed.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(here, "..", "locales");
const KEYS_FILE = "C:\\Users\\airau\\.secrets\\claude-credit-keys.env";
const MODEL = "claude-opus-5-5";
const CHUNK = 90;

const LANGUAGE_NAMES = {
  ar: "Arabic", bg: "Bulgarian", cs: "Czech", de: "German", el: "Greek", es: "Spanish (neutral Latin American / Spain)",
  fa: "Persian (Farsi)", fr: "French", id: "Indonesian", it: "Italian", ja: "Japanese", ko: "Korean", mi: "Māori",
  nb: "Norwegian Bokmål", nl: "Dutch", pl: "Polish", pt_br: "Brazilian Portuguese", ro: "Romanian", ru: "Russian",
  sv: "Swedish", th: "Thai", tr: "Turkish", uk: "Ukrainian", vi: "Vietnamese", zh_cn: "Simplified Chinese",
  zh_sg: "Simplified Chinese (Singapore)", zh_tw: "Traditional Chinese (Taiwan)"
};

function loadKeys() {
  const keys = [];
  if (fs.existsSync(KEYS_FILE)) {
    for (const line of fs.readFileSync(KEYS_FILE, "utf8").split(/\r?\n/)) {
      const m = line.match(/^CLAUDE_(SHELLIX|AIRA|EDU)=(.+)$/);
      if (m && m[2].trim()) keys.push({ label: m[1].toLowerCase(), key: m[2].trim() });
    }
  }
  if (!keys.length && process.env.ANTHROPIC_API_KEY) keys.push({ label: "env", key: process.env.ANTHROPIC_API_KEY });
  return keys;
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else if (typeof v === "string") out[key] = v;
  }
  return out;
}

function getPath(obj, key) {
  return key.split(".").reduce((node, part) => (node == null ? node : node[part]), obj);
}

function setPath(obj, key, value) {
  const parts = key.split(".");
  let node = obj;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== "object" || node[part] === null) node[part] = {};
    node = node[part];
  }
  node[parts.at(-1)] = value;
}

/** Placeholders, command mentions and markdown that must survive translation. */
function tokens(text) {
  const found = text.match(/\{\{?\s*[\w.]+\s*\}?\}|<\/[\w ]+:\{?\w+\}?>|\*\*|`/g) ?? [];
  return found.sort().join("|");
}

let keyIndex = 0;
const keys = loadKeys();
const deadKeys = new Set();

async function callClaude(params) {
  for (let attempt = 0; attempt < keys.length * 2; attempt++) {
    const entry = keys[keyIndex % keys.length];
    if (deadKeys.has(entry.label)) {
      keyIndex++;
      continue;
    }
    const client = new Anthropic({ apiKey: entry.key, maxRetries: 3, timeout: 10 * 60 * 1000 });
    try {
      return await client.beta.messages.create(params);
    } catch (error) {
      const message = String(error?.error?.error?.message ?? error?.message ?? "");
      const creditProblem =
        error?.status === 402 ||
        (error instanceof Anthropic.BadRequestError && /credit balance/i.test(message)) ||
        error instanceof Anthropic.AuthenticationError ||
        error instanceof Anthropic.PermissionDeniedError;
      if (creditProblem) {
        console.warn(`  key "${entry.label}" unusable (${error.status}); rotating`);
        deadKeys.add(entry.label);
        keyIndex++;
        continue;
      }
      throw error;
    }
  }
  throw new Error("No API key with credits left");
}

const SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: { key: { type: "string" }, text: { type: "string" } },
        required: ["key", "text"],
        additionalProperties: false
      }
    }
  },
  required: ["translations"],
  additionalProperties: false
};

const SYSTEM = `You translate the user interface strings of a Discord music bot called "Bypass".
Rules:
- Translate naturally for Discord users, short and friendly, like a native app. Use the informal "you" where the language allows it.
- Keep EXACTLY unchanged: placeholders in braces such as {title}, {count}, {{name}}; Discord command mentions like </play:{playId}>; slash command names like /play, /help, /settings, /247 (never translate the command word); markdown (**bold**, \`code\`, -# ); emoji; URLs; brand names (Bypass, Discord, YouTube, Spotify, SoundCloud, Apple Music, Deezer, Patreon, top.gg, Founder).
- Keep line breaks (\\n) where they are.
- Return one translation for every input key, with the same key.`;

async function translateChunk(locale, entries) {
  const response = await callClaude({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Target language: ${LANGUAGE_NAMES[locale] ?? locale} (locale "${locale}").\n\nStrings (JSON, key → English):\n${JSON.stringify(Object.fromEntries(entries), null, 1)}`
      }
    ]
  });
  if (response.stop_reason === "refusal") {
    console.warn(`  refusal (${response.stop_details?.category ?? "unknown"}); skipping chunk`);
    return {};
  }
  if (response.stop_reason === "max_tokens") console.warn("  hit max_tokens; partial chunk");
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = JSON.parse(text);
  return Object.fromEntries(parsed.translations.map((t) => [t.key, t.text]));
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const only = args.filter((a) => !a.startsWith("--"));
  const en = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8"));
  const enFlat = flatten(en);
  const locales = Object.keys(LANGUAGE_NAMES).filter((l) => !only.length || only.includes(l));

  if (!dry && !keys.length) throw new Error("No API keys found");
  let total = 0;

  for (const locale of locales) {
    const file = path.join(LOCALES_DIR, `${locale}.json`);
    const catalog = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
    const missing = Object.entries(enFlat).filter(([key]) => typeof getPath(catalog, key) !== "string");
    total += missing.length;
    console.log(`${locale}: ${missing.length} missing`);
    if (dry || missing.length === 0) continue;

    let added = 0;
    let rejected = 0;
    for (let i = 0; i < missing.length; i += CHUNK) {
      const chunk = missing.slice(i, i + CHUNK);
      let result = {};
      try {
        result = await translateChunk(locale, chunk);
      } catch (error) {
        console.error(`  chunk ${i / CHUNK + 1} failed: ${error?.status ?? ""} ${error?.message ?? error}`);
        continue;
      }
      for (const [key, english] of chunk) {
        const translated = result[key];
        if (typeof translated !== "string" || !translated.trim()) continue;
        if (tokens(translated) !== tokens(english)) {
          rejected++;
          continue; // a lost/renamed placeholder would break at runtime; English fallback instead
        }
        setPath(catalog, key, translated);
        added++;
      }
      // Save after every chunk so an interruption keeps the work done so far.
      fs.writeFileSync(file, JSON.stringify(catalog, null, 2) + "\n");
    }
    console.log(`  ✓ ${added} added${rejected ? `, ${rejected} rejected (placeholder mismatch)` : ""}`);
  }
  if (dry) console.log(`total missing: ${total}`);
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
