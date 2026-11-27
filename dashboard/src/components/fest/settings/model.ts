/**
 * Settings screen model: which fields each section owns, how a draft value is
 * compared with the saved one, what gets sent on save, and inline validation.
 * Field names follow the bot's settings document (models/GuildSettings.ts).
 */

export type Doc = Record<string, unknown>;

export type SectionId = "playback" | "voice" | "channels" | "stages" | "look" | "commands" | "safety";

export interface SectionDef {
  id: SectionId;
  title: string;
  /** Settings document keys saved by this section (Stages saves bindings instead). */
  keys: string[];
}

export const SECTIONS: SectionDef[] = [
  {
    id: "playback",
    title: "Playback",
    keys: ["defaultVolume", "maxVolume", "maxQueueSize", "maxSongDuration", "preventDuplicates", "autoplay", "voteSkipPercentage"],
  },
  { id: "voice", title: "Voice", keys: ["autoLeaveEmpty", "autoLeaveTimeout"] },
  { id: "channels", title: "Channels", keys: ["allowedTextChannels", "allowedVoiceChannels", "logChannelId"] },
  { id: "stages", title: "Stages", keys: [] },
  { id: "look", title: "Language & look", keys: ["language", "embedColor"] },
  { id: "commands", title: "Commands", keys: ["disabledCommands"] },
  { id: "safety", title: "Safety", keys: ["blacklistedUsers"] },
];

/**
 * The bot's shipped locales (utils/i18n.ts BOT_LOCALES), stored exactly the
 * way `/language` stores them. Native name first, English name after.
 */
export const LANGUAGES: { code: string; native: string; english: string }[] = [
  { code: "ar", native: "العربية", english: "Arabic" },
  { code: "bg", native: "Български", english: "Bulgarian" },
  { code: "zh_cn", native: "简体中文", english: "Chinese, Simplified" },
  { code: "zh_sg", native: "简体中文（新加坡）", english: "Chinese, Singapore" },
  { code: "zh_tw", native: "繁體中文", english: "Chinese, Traditional" },
  { code: "cs", native: "Čeština", english: "Czech" },
  { code: "nl", native: "Nederlands", english: "Dutch" },
  { code: "en", native: "English", english: "English" },
  { code: "fr", native: "Français", english: "French" },
  { code: "de", native: "Deutsch", english: "German" },
  { code: "el", native: "Ελληνικά", english: "Greek" },
  { code: "id", native: "Bahasa Indonesia", english: "Indonesian" },
  { code: "it", native: "Italiano", english: "Italian" },
  { code: "ja", native: "日本語", english: "Japanese" },
  { code: "ko", native: "한국어", english: "Korean" },
  { code: "mi", native: "Te Reo Māori", english: "Māori" },
  { code: "nb", native: "Norsk bokmål", english: "Norwegian" },
  { code: "fa", native: "فارسی", english: "Persian" },
  { code: "pl", native: "Polski", english: "Polish" },
  { code: "pt_br", native: "Português (Brasil)", english: "Portuguese, Brazil" },
  { code: "ro", native: "Română", english: "Romanian" },
  { code: "ru", native: "Русский", english: "Russian" },
  { code: "es", native: "Español", english: "Spanish" },
  { code: "sv", native: "Svenska", english: "Swedish" },
  { code: "th", native: "ไทย", english: "Thai" },
  { code: "tr", native: "Türkçe", english: "Turkish" },
  { code: "uk", native: "Українська", english: "Ukrainian" },
  { code: "vi", native: "Tiếng Việt", english: "Vietnamese" },
];

const LANGUAGE_ALIASES: Record<string, string> = {
  en_us: "en",
  en_gb: "en",
  es_es: "es",
  es_419: "es",
  no: "nb",
  sv_se: "sv",
  pt: "pt_br",
  pt_pt: "pt_br",
  zh: "zh_cn",
};

/** Same mapping the bot applies (toBotLocale), so "pt-BR" and "pt_br" read as one value. */
export function normLanguage(v: unknown): string {
  const raw = typeof v === "string" && v ? v : "auto";
  if (raw === "auto") return "auto";
  const n = raw.toLowerCase().replace("-", "_");
  if (LANGUAGES.some((l) => l.code === n)) return n;
  if (LANGUAGE_ALIASES[n]) return LANGUAGE_ALIASES[n];
  const short = n.split("_")[0];
  if (LANGUAGES.some((l) => l.code === short)) return short;
  return raw;
}

/** Wait-before-leaving presets, in seconds (the bot accepts 30 to 3600). */
export const LEAVE_PRESETS = [30, 60, 120, 300, 600, 900, 1800, 3600];

export function fmtSeconds(sec: number): string {
  if (sec < 60) return `${sec} seconds`;
  const min = sec / 60;
  if (min === 60) return "1 hour";
  if (Number.isInteger(min)) return `${min} minute${min === 1 ? "" : "s"}`;
  return `${Math.floor(min)} min ${sec % 60} s`;
}

export interface Stay247 {
  enabled: boolean;
  voiceChannelId: string | null;
  [k: string]: unknown;
}

export function stay247Of(v: unknown): Stay247 {
  const o = (v && typeof v === "object" ? v : {}) as Partial<Stay247>;
  return { ...o, enabled: Boolean(o.enabled), voiceChannelId: o.voiceChannelId ?? null };
}

export function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : v == null || v === "" ? fallback : Number(v);
}

export function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

/** Comparable form of a field, so "no real change" never shows as unsaved. */
export function comparable(key: string, v: unknown): unknown {
  switch (key) {
    case "maxSongDuration":
      // Edited in minutes; 905 s and 900 s both read "15 min".
      return Math.round(num(v) / 60);
    case "stay247": {
      const s = stay247Of(v);
      return { enabled: s.enabled, voiceChannelId: s.enabled ? s.voiceChannelId : null };
    }
    case "language":
      return normLanguage(v);
    case "embedColor":
      return typeof v === "string" ? v.toLowerCase() : v;
    case "logChannelId":
      return v || null;
    case "allowedTextChannels":
    case "allowedVoiceChannels":
    case "disabledCommands":
    case "blacklistedUsers":
      return [...list(v)].sort();
    default:
      return v ?? null;
  }
}

export function same(key: string, a: unknown, b: unknown): boolean {
  const x = comparable(key, a);
  const y = comparable(key, b);
  if (typeof x === "number" && typeof y === "number" && Number.isNaN(x) && Number.isNaN(y)) return true;
  return JSON.stringify(x) === JSON.stringify(y);
}

/** Inline problems for one section, keyed by field. */
export function validate(id: SectionId, get: (k: string) => unknown): Record<string, string> {
  const e: Record<string, string> = {};
  const intIn = (k: string, lo: number, hi: number, msg: string) => {
    const v = num(get(k), NaN);
    if (!Number.isFinite(v)) e[k] = "Enter a number.";
    else if (!Number.isInteger(v) || v < lo || v > hi) e[k] = msg;
  };
  if (id === "playback") {
    intIn("defaultVolume", 0, 100, "Default volume goes from 0 to 100%.");
    intIn("maxVolume", 0, 100, "Max volume goes from 0 to 100%.");
    intIn("maxQueueSize", 1, 1000, "A queue holds 1 to 1,000 songs.");
    intIn("voteSkipPercentage", 1, 100, "Pick 1 to 100%.");
    const minutes = num(get("maxSongDuration"), NaN) / 60;
    if (!Number.isFinite(minutes)) e.maxSongDuration = "Enter a number of minutes, or 0 for no limit.";
    else if (minutes < 0) e.maxSongDuration = "Use 0 for no limit, or a number of minutes.";
    if (!e.maxVolume && !e.defaultVolume && num(get("maxVolume")) < num(get("defaultVolume"))) {
      e.maxVolume = `Max volume can't be below the default volume (${num(get("defaultVolume"))}%). Raise it, or lower the default.`;
    }
  }
  if (id === "voice") {
    intIn("autoLeaveTimeout", 30, 3600, "Wait 30 seconds to 1 hour.");
    const s = stay247Of(get("stay247"));
    if (s.enabled && !s.voiceChannelId) e.stay247 = "Pick the voice channel Bypass stays in.";
  }
  if (id === "look") {
    const c = get("embedColor");
    if (typeof c !== "string" || !/^#[0-9a-f]{6}$/i.test(c)) e.embedColor = "Use a hex colour like #e8402a.";
  }
  return e;
}

/** Value sent for a changed field (merged where the document nests it). */
export function outgoing(key: string, draft: unknown, saved: unknown): unknown {
  if (key === "stay247") {
    const s = stay247Of(draft);
    return { ...stay247Of(saved), enabled: s.enabled, voiceChannelId: s.voiceChannelId };
  }
  if (key === "language") return normLanguage(draft);
  if (key === "logChannelId") return draft || null;
  if (key === "maxSongDuration") return Math.round(num(draft) / 60) * 60;
  return draft;
}

export const STAGE_COLOUR_NAMES: Record<number, string> = {
  1: "Red",
  2: "Blue",
  3: "Yellow",
  4: "Green",
  5: "Magenta",
  6: "Teal",
  7: "Orange",
  8: "Violet",
};
