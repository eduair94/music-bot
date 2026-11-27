import { AsyncLocalStorage } from "async_hooks";
import base from "i18n";
import { join } from "path";
import { config } from "./config";

/**
 * Locale files shipped in ./locales. Discord clients report their language as
 * `interaction.locale` (e.g. "es-ES", "pt-BR"); `toBotLocale` maps those onto
 * these file names.
 */
export const BOT_LOCALES = [
  "ar",
  "bg",
  "cs",
  "de",
  "el",
  "en",
  "es",
  "fa",
  "fr",
  "id",
  "it",
  "ja",
  "ko",
  "mi",
  "nb",
  "nl",
  "pl",
  "pt_br",
  "ro",
  "ru",
  "sv",
  "th",
  "tr",
  "uk",
  "vi",
  "zh_cn",
  "zh_sg",
  "zh_tw"
] as const;

export type BotLocale = (typeof BOT_LOCALES)[number];

/** Human names for the language picker. */
export const LOCALE_NAMES: Record<BotLocale, string> = {
  ar: "العربية",
  bg: "Български",
  cs: "Čeština",
  de: "Deutsch",
  el: "Ελληνικά",
  en: "English",
  es: "Español",
  fa: "فارسی",
  fr: "Français",
  id: "Bahasa Indonesia",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  mi: "Te Reo Māori",
  nb: "Norsk bokmål",
  nl: "Nederlands",
  pl: "Polski",
  pt_br: "Português (Brasil)",
  ro: "Română",
  ru: "Русский",
  sv: "Svenska",
  th: "ไทย",
  tr: "Türkçe",
  uk: "Українська",
  vi: "Tiếng Việt",
  zh_cn: "简体中文",
  zh_sg: "简体中文（新加坡）",
  zh_tw: "繁體中文"
};

/**
 * Discord locale codes (https://discord.com/developers/docs/reference#locales)
 * for each bot locale, used for command name/description localizations.
 * Locales Discord does not support (ar, fa, mi, zh_sg) have no entry.
 */
export const DISCORD_LOCALES: Partial<Record<BotLocale, string[]>> = {
  bg: ["bg"],
  cs: ["cs"],
  de: ["de"],
  el: ["el"],
  es: ["es-ES", "es-419"],
  fr: ["fr"],
  id: ["id"],
  it: ["it"],
  ja: ["ja"],
  ko: ["ko"],
  nb: ["no"],
  nl: ["nl"],
  pl: ["pl"],
  pt_br: ["pt-BR"],
  ro: ["ro"],
  ru: ["ru"],
  sv: ["sv-SE"],
  th: ["th"],
  tr: ["tr"],
  uk: ["uk"],
  vi: ["vi"],
  zh_cn: ["zh-CN"],
  zh_tw: ["zh-TW"]
};

base.configure({
  locales: [...BOT_LOCALES],
  directory: join(__dirname, "..", "locales"),
  defaultLocale: "en",
  retryInDefaultLocale: true,
  objectNotation: true,
  // Never write missing keys back into the locale files at runtime.
  updateFiles: false,
  syncFiles: false,
  register: global,

  logWarnFn: function (msg) {
    console.log(msg);
  },

  logErrorFn: function (msg) {
    console.log(msg);
  },

  missingKeyFn: function (_locale, value) {
    return value;
  },

  // No locale string uses {{mustache}}; left on, i18n would run Mustache over
  // the finished text, so a song title or collection name like "{{#a}}"
  // makes every reply that names it throw.
  mustacheConfig: {
    tags: ["{{", "}}"],
    disable: true
  }
});

const DEFAULT_LOCALE: BotLocale = (BOT_LOCALES as readonly string[]).includes(config.LOCALE)
  ? (config.LOCALE as BotLocale)
  : "en";
base.setLocale(DEFAULT_LOCALE);

/**
 * Map any locale string (a Discord locale such as "pt-BR", or a stored bot
 * locale such as "pt_br") onto a shipped locale file. Returns null when the
 * language is not available.
 */
export function toBotLocale(locale: string | null | undefined): BotLocale | null {
  if (!locale) return null;
  const normalized = locale.toLowerCase().replace("-", "_");
  if ((BOT_LOCALES as readonly string[]).includes(normalized)) return normalized as BotLocale;

  const aliases: Record<string, BotLocale> = {
    en_us: "en",
    en_gb: "en",
    es_es: "es",
    es_419: "es",
    no: "nb",
    sv_se: "sv",
    pt: "pt_br",
    pt_pt: "pt_br",
    zh: "zh_cn"
  };
  if (aliases[normalized]) return aliases[normalized];

  const short = normalized.split("_")[0];
  if ((BOT_LOCALES as readonly string[]).includes(short)) return short as BotLocale;
  return null;
}

/**
 * Pick the locale for a request: an explicit server language wins, otherwise
 * the user's Discord client language, otherwise the server's community
 * locale, otherwise the bot default.
 */
export function resolveLocale(options: {
  guildSetting?: string | null;
  userLocale?: string | null;
  guildLocale?: string | null;
}): BotLocale {
  const setting = options.guildSetting && options.guildSetting !== "auto" ? toBotLocale(options.guildSetting) : null;
  return setting ?? toBotLocale(options.userLocale) ?? toBotLocale(options.guildLocale) ?? DEFAULT_LOCALE;
}

const storage = new AsyncLocalStorage<BotLocale>();

/** Run `fn` (and everything it awaits) with `locale` as the active language. */
export function runWithLocale<T>(locale: BotLocale, fn: () => T): T {
  return storage.run(locale, fn);
}

/** The language of the current request, or the bot default outside one. */
export function currentLocale(): BotLocale {
  return storage.getStore() ?? DEFAULT_LOCALE;
}

type Replacements = Record<string, unknown>;

/**
 * Drop-in replacement for the i18n module used across the bot. `__` and
 * `__mf` read the language of the current request from AsyncLocalStorage,
 * so existing `i18n.__("key")` calls follow the server/user language without
 * threading a locale through every function.
 */
export const i18n = {
  __(phrase: string, ...replace: any[]): string {
    return base.__({ phrase, locale: currentLocale() }, ...replace);
  },
  __mf(phrase: string, replacements?: Replacements): string {
    return base.__mf({ phrase, locale: currentLocale() }, replacements as any);
  },
  /** Translate into an explicit locale, ignoring the request context. */
  t(locale: BotLocale, phrase: string, replacements?: Replacements): string {
    return replacements ? base.__mf({ phrase, locale }, replacements as any) : base.__({ phrase, locale });
  },
  getLocale(): BotLocale {
    return currentLocale();
  },
  setLocale(locale: string): void {
    base.setLocale(locale);
  },
  getCatalog(locale: string) {
    return base.getCatalog(locale);
  }
};

/**
 * Look up a key in one locale's catalog without falling back to English.
 * Returns null when that locale has no translation of its own.
 */
export function ownTranslation(locale: BotLocale, key: string): string | null {
  const catalog = base.getCatalog(locale) as Record<string, any>;
  const value = key.split(".").reduce<any>((node, part) => (node == null ? node : node[part]), catalog);
  return typeof value === "string" && value.trim() ? value : null;
}

/**
 * Discord `description_localizations` for a key such as "play.description":
 * every Discord locale whose catalog has its own, valid-length translation.
 */
export function descriptionLocalizations(key: string): Record<string, string> | undefined {
  const english = ownTranslation("en", key);
  const result: Record<string, string> = {};
  for (const [botLocale, discordLocales] of Object.entries(DISCORD_LOCALES) as [BotLocale, string[]][]) {
    const text = ownTranslation(botLocale, key);
    if (!text || text === english || text.length > 100) continue;
    for (const discordLocale of discordLocales) result[discordLocale] = text;
  }
  return Object.keys(result).length ? result : undefined;
}

let englishIndex: Map<string, string[]> | null = null;

/** English text → every key whose en.json value is exactly that text. */
function keysForEnglish(text: string): string[] {
  if (!englishIndex) {
    englishIndex = new Map();
    const walk = (node: Record<string, any>, prefix: string) => {
      for (const [k, v] of Object.entries(node)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "string") {
          const list = englishIndex!.get(v);
          if (list) list.push(key);
          else englishIndex!.set(v, [key]);
        } else if (v && typeof v === "object") walk(v, key);
      }
    };
    walk(base.getCatalog("en") as Record<string, any>, "");
  }
  return englishIndex.get(text) ?? [];
}

/** Localizations for a builder string that was written with i18n.__ at load time. */
function localizationsForText(text: string | undefined, command: string): Record<string, string> | undefined {
  if (!text) return undefined;
  const keys = keysForEnglish(text);
  if (!keys.length) return undefined;
  const key = keys.find((k) => k.startsWith(`${command}.`)) ?? keys[0];
  return descriptionLocalizations(key);
}

/**
 * Fill `description_localizations` on a slash command's subcommands and
 * options, and `name_localizations` on choices, from the locale catalogs.
 * Builders call `i18n.__("x.y")` at module load (English), so each English
 * text is mapped back to its key and that key's translations are attached.
 * Strings without a key stay English-only.
 */
export function localizeCommandJson(json: any): any {
  const command = json.name as string;
  json.description_localizations ??= descriptionLocalizations(`${command}.description`) ?? localizationsForText(json.description, command);
  const walk = (options: any[] | undefined) => {
    for (const option of options ?? []) {
      option.description_localizations ??= localizationsForText(option.description, command);
      for (const choice of option.choices ?? []) {
        choice.name_localizations ??= localizationsForText(choice.name, command);
      }
      walk(option.options);
    }
  };
  walk(json.options);
  return json;
}
