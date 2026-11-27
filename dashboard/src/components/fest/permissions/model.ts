/**
 * Permission editor vocabulary: the action groups in plain words, the three
 * modes as festival wristbands, and helpers to normalise, compare and
 * describe a PermissionConfig. Pure; no React.
 */
// Relative import keeps this module loadable by vitest (no "@/" alias there).
import { GROUPS } from "../../../lib/dash/types";
import type { Group, GroupRule, GuildRole, PermissionConfig, RuleMode } from "../../../lib/dash/types";

export interface GroupInfo {
  group: Group;
  name: string;
  description: string;
}

export const GROUP_INFO: Record<Group, GroupInfo> = {
  play: { group: "play", name: "Add songs", description: "Play, search and queue tracks." },
  playback: { group: "playback", name: "Pause, resume, seek, previous", description: "Control the song that is playing now." },
  skip: { group: "skip", name: "Skip", description: "Skip to the next song, or jump ahead in the queue." },
  queue: { group: "queue", name: "Reorder and remove", description: "Move, remove, shuffle and clear queued songs." },
  volume: { group: "volume", name: "Volume", description: "Change how loud the bot plays." },
  effects: { group: "effects", name: "Effects", description: "Bass boost, nightcore, 8D and the other filters." },
  loop_autoplay: { group: "loop_autoplay", name: "Loop and autoplay", description: "Repeat a song or the queue, or keep the music going." },
  stop_leave: { group: "stop_leave", name: "Stop and disconnect", description: "Stop the music, or move the bot in and out of voice." },
  lyrics_view: { group: "lyrics_view", name: "Lyrics", description: "Show the lyrics of the song that is playing." },
  settings: { group: "settings", name: "Dashboard settings", description: "Change these permissions and every server setting." },
};

export interface ModeInfo {
  mode: RuleMode;
  name: string;
  stamp: string;
  who: string;
  band: string;
  color: string;
  on: string;
  tint: string;
}

/** Wristband colours: yellow general admission, blue DJ, red crew. */
export const MODES: ModeInfo[] = [
  { mode: "everyone", name: "Everyone", stamp: "Everyone", who: "Anyone in the server", band: "/dash/band-yellow.webp", color: "#f5b700", on: "#151515", tint: "#f6e5b0" },
  { mode: "dj", name: "DJs", stamp: "DJs", who: "DJ roles and admins", band: "/dash/band-blue.webp", color: "#2a5bd7", on: "#ffffff", tint: "#d5dff5" },
  { mode: "admins", name: "Admins", stamp: "Admins", who: "Manage Server or the admin role", band: "/dash/band-red.webp", color: "#e8402a", on: "#ffffff", tint: "#f7d9cf" },
];

export const MODE: Record<RuleMode, ModeInfo> = Object.fromEntries(MODES.map((m) => [m.mode, m])) as Record<RuleMode, ModeInfo>;

export const MODE_RANK: Record<RuleMode, number> = { everyone: 0, dj: 1, admins: 2 };

function defaultRule(group: Group): GroupRule {
  return { mode: group === "settings" ? "admins" : "everyone", allowRoles: [], denyRoles: [], allowUsers: [], denyUsers: [] };
}

const uniq = (a: unknown): string[] => (Array.isArray(a) ? Array.from(new Set(a.filter((x): x is string => typeof x === "string"))) : []);

/** Fill gaps so the editor always has every group, list and option. */
export function normalize(input: Partial<PermissionConfig> | null | undefined): PermissionConfig {
  const c = input ?? {};
  const groups = {} as Record<Group, GroupRule>;
  for (const g of GROUPS) {
    const r = (c.groups?.[g] ?? {}) as Partial<GroupRule>;
    const base = defaultRule(g);
    groups[g] = {
      mode: r.mode === "everyone" || r.mode === "dj" || r.mode === "admins" ? r.mode : base.mode,
      allowRoles: uniq(r.allowRoles),
      denyRoles: uniq(r.denyRoles),
      allowUsers: uniq(r.allowUsers),
      denyUsers: uniq(r.denyUsers),
    };
  }
  const vs = c.options?.voteSkip;
  const instanceChannels: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(c.instanceChannels ?? {})) instanceChannels[k] = uniq(v);
  return {
    djRoles: uniq(c.djRoles),
    groups,
    options: {
      requesterCanSkipOwn: Boolean(c.options?.requesterCanSkipOwn),
      aloneIsDj: Boolean(c.options?.aloneIsDj),
      voteSkip: {
        enabled: Boolean(vs?.enabled),
        percentage: clampPct(typeof vs?.percentage === "number" ? vs.percentage : 50),
      },
    },
    instanceChannels,
  };
}

export function clampPct(n: number): number {
  return Math.min(100, Math.max(10, Math.round(n)));
}

/** Stable comparison key: order-insensitive lists, empty channel scopes dropped. */
export function configKey(c: PermissionConfig): string {
  const sort = (a: string[]) => [...a].sort();
  const groups = GROUPS.map((g) => {
    const r = c.groups[g];
    return [g, r.mode, sort(r.allowRoles), sort(r.denyRoles), sort(r.allowUsers), sort(r.denyUsers)];
  });
  const channels = Object.entries(c.instanceChannels)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => [k, sort(v)])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return JSON.stringify([sort(c.djRoles), groups, c.options, channels]);
}

/** Short human summary of what changed, for the save confirmation. */
export function describeChanges(before: PermissionConfig, after: PermissionConfig): string[] {
  const out: string[] = [];
  for (const g of GROUPS) {
    const a = before.groups[g];
    const b = after.groups[g];
    if (a.mode !== b.mode) out.push(`${GROUP_INFO[g].name}: ${MODE[b.mode].name}`);
    const lists: (keyof GroupRule)[] = ["allowRoles", "denyRoles", "allowUsers", "denyUsers"];
    if (lists.some((k) => JSON.stringify([...(a[k] as string[])].sort()) !== JSON.stringify([...(b[k] as string[])].sort()))) {
      out.push(`${GROUP_INFO[g].name} exceptions`);
    }
  }
  if (JSON.stringify([...before.djRoles].sort()) !== JSON.stringify([...after.djRoles].sort())) out.push("DJ roles");
  if (JSON.stringify(before.options) !== JSON.stringify(after.options)) out.push("House rules");
  const ch = (c: PermissionConfig) =>
    JSON.stringify(
      Object.entries(c.instanceChannels)
        .filter(([, v]) => v.length)
        .map(([k, v]) => [k, [...v].sort()])
        .sort(),
    );
  if (ch(before) !== ch(after)) out.push("Stage channels");
  return out;
}

/** Discord role colour (0 = none) as CSS. */
export function roleColor(role: Pick<GuildRole, "color"> | undefined): string {
  if (!role || !role.color) return "#8a8378";
  return `#${role.color.toString(16).padStart(6, "0")}`;
}

/** Roles a member can actually hold, highest first, without @everyone. */
export function pickableRoles(roles: GuildRole[], guildId: string): GuildRole[] {
  return roles.filter((r) => r.id !== guildId && r.name !== "@everyone").sort((a, b) => b.position - a.position);
}

/** "Only admins (Manage Server or the admin role) and @Mods can change these." */
export function whoCanChange(c: PermissionConfig, roleName: (id: string) => string): string {
  const r = c.groups.settings;
  if (r.mode === "everyone") return "Anyone in this server can change these.";
  const extra = r.allowRoles.map((id) => `@${roleName(id)}`);
  const base = r.mode === "dj" ? "Only DJs and admins" : "Only admins (Manage Server or the admin role)";
  if (!extra.length) return `${base} can change these.`;
  const list = extra.length === 1 ? extra[0] : `${extra.slice(0, -1).join(", ")} and ${extra[extra.length - 1]}`;
  return `${base} and ${list} can change these.`;
}

export const USER_ID = /^\d{17,20}$/;
