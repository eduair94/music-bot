import type { GuildQueue, QueueFilters } from "discord-player";

export type FilterName = keyof QueueFilters;

/**
 * Effect names (the /effects subcommands, also used by the dashboard's
 * `filter {name}` command and the playback state's `filters`) → the
 * discord-player FFmpeg filter behind each.
 */
export const EFFECT_FILTERS: Record<string, FilterName> = {
  "8d": "8D",
  bassboost: "bassboost",
  distortion: "earrape", // earrape is the closest preset to distortion
  haas: "haas",
  karaoke: "karaoke",
  nightcore: "nightcore",
  vaporwave: "vaporwave",
  pulsator: "pulsator",
  reverse: "reverse",
  tremolo: "tremolo",
  vibrato: "vibrato",
  lofi: "lofi",
  surrounding: "surrounding"
};

export type BassLevel = "off" | "low" | "medium" | "high";

/** Bass boost levels map to discord-player presets; only one is active at a time. */
export const BASS_PRESETS: Record<Exclude<BassLevel, "off">, FilterName> = {
  low: "bassboost_low" as FilterName,
  medium: "bassboost" as FilterName,
  high: "bassboost_high" as FilterName
};
const BASS_FILTERS = Object.values(BASS_PRESETS) as string[];

/** Nightcore and vaporwave change speed in opposite directions. */
const EXCLUSIVE: Record<string, string> = { nightcore: "vaporwave", vaporwave: "nightcore" };

/** FFmpeg filters enabled on the queue (raw discord-player names). */
export function enabledFilters(queue: GuildQueue): string[] {
  try {
    return (queue.filters?.ffmpeg?.getFiltersEnabled?.() ?? []) as string[];
  } catch {
    return [];
  }
}

/** Active effects by effect name ("nightcore", "bassboost", …); filters set some other way keep their raw name. */
export function activeEffects(queue: GuildQueue): string[] {
  const names = new Set<string>();
  for (const filter of enabledFilters(queue)) {
    if (BASS_FILTERS.includes(filter)) {
      names.add("bassboost");
      continue;
    }
    const effect = Object.keys(EFFECT_FILTERS).find((key) => EFFECT_FILTERS[key] === filter);
    names.add(effect ?? filter);
  }
  return [...names];
}

/** An effect name from user input ("Nightcore", "8D", "earrape" → "distortion"), or null. */
export function resolveEffect(input: string | null | undefined): string | null {
  const name = (input ?? "").trim().toLowerCase();
  if (!name) return null;
  if (EFFECT_FILTERS[name]) return name;
  if (BASS_FILTERS.includes(name)) return "bassboost";
  return Object.keys(EFFECT_FILTERS).find((key) => EFFECT_FILTERS[key].toLowerCase() === name) ?? null;
}

/** The active bass boost level. */
export function bassLevel(queue: GuildQueue): BassLevel {
  const enabled = enabledFilters(queue);
  const level = (Object.keys(BASS_PRESETS) as Exclude<BassLevel, "off">[]).find((l) => enabled.includes(BASS_PRESETS[l]));
  return level ?? "off";
}

/** Set the bass boost level. Returns whether a level was active before. */
export async function setBassBoost(queue: GuildQueue, level: BassLevel): Promise<{ wasActive: boolean }> {
  const enabled = enabledFilters(queue);
  const active = BASS_FILTERS.filter((f) => enabled.includes(f)) as FilterName[];
  if (active.length) await queue.filters.ffmpeg.toggle(active);
  if (level !== "off") await queue.filters.ffmpeg.toggle([BASS_PRESETS[level]]);
  return { wasActive: active.length > 0 };
}

/**
 * Turn an effect on/off (`enabled` null = toggle), keeping nightcore and
 * vaporwave exclusive. Bass boost on = medium. Returns the new state.
 */
export async function setEffect(queue: GuildQueue, effect: string, enabled: boolean | null): Promise<boolean> {
  if (effect === "bassboost") {
    const current = bassLevel(queue);
    const on = enabled ?? current === "off";
    if (on === (current !== "off")) return on;
    await setBassBoost(queue, on ? "medium" : "off");
    return on;
  }

  const filter = EFFECT_FILTERS[effect];
  if (!filter) throw new Error(`Unknown effect: ${effect}`);
  const current = enabledFilters(queue);
  const isEnabled = current.includes(filter);
  const shouldEnable = enabled ?? !isEnabled;

  const rival = EXCLUSIVE[effect];
  if (shouldEnable && rival && current.includes(EFFECT_FILTERS[rival])) {
    await queue.filters.ffmpeg.toggle([EFFECT_FILTERS[rival]]);
  }
  if (shouldEnable !== isEnabled) await queue.filters.ffmpeg.toggle([filter]);
  return shouldEnable;
}

/** Turn every effect off. */
export async function clearEffects(queue: GuildQueue): Promise<void> {
  const current = enabledFilters(queue) as FilterName[];
  if (current.length > 0) await queue.filters.ffmpeg.toggle(current);
}
