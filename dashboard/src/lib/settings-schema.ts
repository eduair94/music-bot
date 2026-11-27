import { isSnowflake } from "../../../shared/permissions";

/**
 * Validation for settings writes from the dashboard (PATCH /settings and the
 * legacy PATCH /api/guilds/[guildId]). Ranges follow the bot: it caps volume
 * at 100, so the dashboard must not store more.
 */

/** Locale files the bot ships (utils/i18n.ts BOT_LOCALES), plus "auto". */
export const SETTINGS_LANGUAGES = [
  "auto", "ar", "bg", "cs", "de", "el", "en", "es", "fa", "fr", "id", "it", "ja", "ko", "mi", "nb",
  "nl", "pl", "pt_br", "ro", "ru", "sv", "th", "tr", "uk", "vi", "zh_cn", "zh_sg", "zh_tw"
] as const;

type Check = { ok: true; value: unknown } | { ok: false; error: string };
type Validator = (value: unknown) => Check;

const ok = (value: unknown): Check => ({ ok: true, value });
const bad = (error: string): Check => ({ ok: false, error });

const int = (min: number, max: number): Validator => (v) =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? ok(v) : bad(`Expected a whole number from ${min} to ${max}`);

const bool: Validator = (v) => (typeof v === "boolean" ? ok(v) : bad("Expected true or false"));

const nullableId: Validator = (v) => (v === null || isSnowflake(v) ? ok(v) : bad("Expected a Discord id or null"));

const idList = (max: number): Validator => (v) => {
  if (!Array.isArray(v)) return bad("Expected a list of Discord ids");
  if (v.length > max) return bad(`At most ${max} entries`);
  if (!v.every(isSnowflake)) return bad("Every entry must be a Discord id");
  return ok(Array.from(new Set(v)));
};

const textList = (max: number, maxLength: number): Validator => (v) => {
  if (!Array.isArray(v)) return bad("Expected a list of text entries");
  if (v.length > max) return bad(`At most ${max} entries`);
  const cleaned: string[] = [];
  for (const entry of v) {
    if (typeof entry !== "string") return bad("Every entry must be text");
    const trimmed = entry.trim();
    if (trimmed.length > maxLength) return bad(`Entries are at most ${maxLength} characters`);
    if (trimmed && !cleaned.includes(trimmed)) cleaned.push(trimmed);
  }
  return ok(cleaned);
};

const commandList: Validator = (v) => {
  if (!Array.isArray(v)) return bad("Expected a list of command names");
  if (v.length > 100) return bad("At most 100 entries");
  if (!v.every((c) => typeof c === "string" && /^[a-z0-9_-]{1,32}$/.test(c))) return bad("Every entry must be a command name");
  return ok(Array.from(new Set(v)));
};

/** The bot stores "disabled" to turn the action log off; null = automatic. */
const logChannel: Validator = (v) => (v === null || v === "disabled" || isSnowflake(v) ? ok(v) : bad('Expected a channel id, "disabled" or null'));

const language: Validator = (v) =>
  typeof v === "string" && (SETTINGS_LANGUAGES as readonly string[]).includes(v) ? ok(v) : bad(`Expected one of ${SETTINGS_LANGUAGES.join(", ")}`);

const hexColor: Validator = (v) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? ok(v.toUpperCase()) : bad("Expected a colour like #F8AA2A"));

/** Every setting the dashboard may change, with its rule. */
export const SETTINGS_FIELDS: Readonly<Record<string, Validator>> = Object.freeze({
  allowedVoiceChannels: idList(100),
  allowedTextChannels: idList(100),
  logChannelId: logChannel,
  djRoleId: nullableId,
  adminRoleId: nullableId,
  defaultVolume: int(0, 100),
  maxVolume: int(1, 100),
  maxQueueSize: int(1, 1000),
  maxSongDuration: int(0, 86400),
  announceNowPlaying: bool,
  autoLeaveEmpty: bool,
  autoLeaveTimeout: int(30, 3600),
  preventDuplicates: bool,
  voteSkipPercentage: int(1, 100),
  autoplay: bool,
  blacklistedUsers: idList(500),
  blacklistedSongs: textList(500, 200),
  blacklistedAuthors: textList(500, 200),
  blacklistedTitles: textList(500, 200),
  disabledCommands: commandList,
  language,
  embedColor: hexColor
});

/**
 * Stored but not writable here: identity and timestamps, counters (bot
 * only), premium (Patreon only), 24/7 (needs the bot to join; use /247),
 * permission rules (PUT /permissions), and legacy prefix/mapping fields.
 */
export const READ_ONLY_SETTINGS = new Set([
  "_id", "__v", "guildId", "createdAt", "updatedAt", "exists",
  "totalSongsPlayed", "totalPlaytime", "premium", "stay247",
  "permissions", "permissionConfig", "prefixes", "mappings", "languageMigrated"
]);

export interface SettingsPatchResult {
  ok: boolean;
  /** Validated values that differ from the stored ones. */
  updates: Record<string, unknown>;
  /** field -> problem; non-empty means nothing may be written. */
  errors: Record<string, string>;
  /** Keys dropped without error (read-only or unknown) in lenient mode. */
  ignored: string[];
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Validate a partial settings write against the stored document.
 * - strict: read-only or unknown fields are errors (new PATCH /settings);
 *   lenient: they are ignored (the legacy form posts the whole document).
 * - Only changed values end up in `updates`, so counters and untouched
 *   fields are never rewritten.
 * - Volume: defaultVolume may not exceed maxVolume; lowering maxVolume alone
 *   brings defaultVolume down with it.
 */
export function validateSettingsPatch(
  body: unknown,
  current: Record<string, any> | null,
  options: { strict: boolean }
): SettingsPatchResult {
  const result: SettingsPatchResult = { ok: false, updates: {}, errors: {}, ignored: [] };
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    result.errors._ = "Expected an object of settings";
    return result;
  }
  const stored = current ?? {};

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    const validator = Object.prototype.hasOwnProperty.call(SETTINGS_FIELDS, key) ? SETTINGS_FIELDS[key] : undefined;
    if (!validator) {
      if (options.strict) result.errors[key] = READ_ONLY_SETTINGS.has(key) ? "This setting cannot be changed here" : "Unknown setting";
      else result.ignored.push(key);
      continue;
    }
    const check = validator(value);
    if (!check.ok) {
      result.errors[key] = check.error;
      continue;
    }
    if (!same(check.value, stored[key])) result.updates[key] = check.value;
  }

  const input = body as Record<string, unknown>;
  const maxVolume = (result.updates.maxVolume ?? input.maxVolume ?? stored.maxVolume ?? 100) as number;
  const defaultVolume = (result.updates.defaultVolume ?? input.defaultVolume ?? stored.defaultVolume ?? 80) as number;
  if (!result.errors.maxVolume && !result.errors.defaultVolume && typeof maxVolume === "number" && typeof defaultVolume === "number" && defaultVolume > maxVolume) {
    if ("defaultVolume" in input) result.errors.defaultVolume = `Must not exceed the maximum volume (${maxVolume})`;
    else result.updates.defaultVolume = maxVolume;
  }

  result.ok = Object.keys(result.errors).length === 0;
  if (!result.ok) result.updates = {};
  return result;
}
