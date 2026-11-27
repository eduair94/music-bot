/**
 * Who may do what in a server: one rule per action group, evaluated the same
 * way by the bot (utils/permissions.ts) and the dashboard API
 * (dashboard/src/lib/guild-access.ts).
 *
 * Pure and dependency-free on purpose: it is imported from both builds.
 * Contract: docs/plans/2026-11-27-dashboard-api.md.
 */

// ---------------------------------------------------------------- types

export const GROUPS = [
  "play",
  "playback",
  "skip",
  "queue",
  "volume",
  "effects",
  "loop_autoplay",
  "stop_leave",
  "lyrics_view",
  "settings"
] as const;

export type Group = (typeof GROUPS)[number];

export const GROUP_MODES = ["everyone", "dj", "admins"] as const;
export type GroupMode = (typeof GROUP_MODES)[number];

export interface GroupRule {
  mode: GroupMode;
  allowRoles: string[];
  denyRoles: string[];
  allowUsers: string[];
  denyUsers: string[];
}

export interface PermissionConfig {
  djRoles: string[];
  groups: Record<Group, GroupRule>;
  options: {
    /** The requester may skip / remove their own songs. */
    requesterCanSkipOwn: boolean;
    /** A member alone with the bot counts as DJ. */
    aloneIsDj: boolean;
    /** Non-DJs may vote-skip. */
    voteSkip: { enabled: boolean; percentage: number };
  };
  /** Instance number -> voice channel ids that instance may serve ([] = any). */
  instanceChannels: Record<string, string[]>;
}

/** The member being checked. Roles come from Discord (bot side or bot-token REST), never from a client. */
export interface PermissionMember {
  id: string;
  roleIds: readonly string[];
  /** Server owner, Manage Server / Administrator, or the configured admin role. */
  isAdmin: boolean;
}

export interface PermissionContext {
  /** The member requested the song(s) the action targets. */
  isRequester?: boolean;
  /** The member is the only listener in the bot's voice channel. */
  aloneWithBot?: boolean;
}

/** Why a check passed or failed. */
export type PermissionReason =
  | "admin"
  | "allowed_user"
  | "allowed_role"
  | "everyone"
  | "dj"
  | "alone"
  | "requester"
  | "denied_user"
  | "denied_role"
  | "needs_dj"
  | "needs_admin";

/** The part of the configuration that decided. */
export type RuleSource =
  | "admin"
  | "allowUsers"
  | "allowRoles"
  | "denyUsers"
  | "denyRoles"
  | "mode"
  | "aloneIsDj"
  | "requesterCanSkipOwn";

export interface MatchedRule {
  group: Group;
  mode: GroupMode;
  source: RuleSource;
  /** The allow/deny role that matched, when the decision came from a role list. */
  roleId?: string;
}

export interface PermissionResult {
  ok: boolean;
  reason: PermissionReason;
  rule: MatchedRule;
}

// ------------------------------------------------------------- defaults

/** Groups whose escape hatch "requester may skip/remove own songs" applies. */
export const REQUESTER_GROUPS: readonly Group[] = ["skip", "queue"];

/** Groups the legacy single DJ role used to guard. */
export const LEGACY_DJ_GROUPS: readonly Group[] = [
  "playback",
  "skip",
  "queue",
  "volume",
  "effects",
  "loop_autoplay",
  "stop_leave"
];

export const DEFAULT_VOTE_SKIP_PERCENTAGE = 50;

const DEFAULT_MODES: Record<Group, GroupMode> = {
  play: "everyone",
  playback: "everyone",
  skip: "everyone",
  queue: "everyone",
  volume: "everyone",
  effects: "everyone",
  loop_autoplay: "everyone",
  stop_leave: "everyone",
  lyrics_view: "everyone",
  settings: "admins"
};

export function emptyRule(mode: GroupMode): GroupRule {
  return { mode, allowRoles: [], denyRoles: [], allowUsers: [], denyUsers: [] };
}

/** A fresh, mutable copy of the defaults. */
export function createDefaultConfig(): PermissionConfig {
  const groups = {} as Record<Group, GroupRule>;
  for (const group of GROUPS) groups[group] = emptyRule(DEFAULT_MODES[group]);
  return {
    djRoles: [],
    groups,
    options: {
      requesterCanSkipOwn: true,
      aloneIsDj: true,
      voteSkip: { enabled: true, percentage: DEFAULT_VOTE_SKIP_PERCENTAGE }
    },
    instanceChannels: {}
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** Defaults for a server with no DJ role and no saved configuration. Frozen: copy with `createDefaultConfig()`. */
export const DEFAULT_CONFIG: Readonly<PermissionConfig> = deepFreeze(createDefaultConfig());

// ------------------------------------------------------------ migration

/** The legacy guild-settings fields the permission system reads. */
export interface LegacySettingsLike {
  djRoleId?: string | null;
  voteSkipPercentage?: number | null;
  permissionConfig?: unknown;
}

export function isSnowflake(value: unknown): value is string {
  return typeof value === "string" && /^\d{17,20}$/.test(value);
}

function clampPercentage(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : DEFAULT_VOTE_SKIP_PERCENTAGE;
  return Math.min(100, Math.max(1, n));
}

/**
 * The configuration equivalent to the pre-2026-11 behaviour, for servers that
 * never saved one: with a DJ role, the DJ-guarded commands stay DJ-only (and
 * no escape hatch loosens them); without one, everyone may use them. Settings
 * stay with admins; vote-skip keeps the server's percentage.
 */
export function migrateFromLegacy(settings: LegacySettingsLike | null | undefined): PermissionConfig {
  const config = createDefaultConfig();
  const djRoleId = settings?.djRoleId;
  const hasDj = isSnowflake(djRoleId);
  if (hasDj) {
    config.djRoles = [djRoleId];
    for (const group of LEGACY_DJ_GROUPS) config.groups[group].mode = "dj";
    config.options.requesterCanSkipOwn = false;
    config.options.aloneIsDj = false;
  }
  config.options.voteSkip.percentage = clampPercentage(settings?.voteSkipPercentage ?? DEFAULT_VOTE_SKIP_PERCENTAGE);
  return config;
}

function stringList(value: unknown, keep: (s: string) => boolean = isSnowflake): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((v): v is string => typeof v === "string" && keep(v))));
}

/**
 * Lenient read of a stored configuration: missing or malformed parts fall
 * back to the defaults, so a partial document never breaks a check.
 */
export function normalizeConfig(input: unknown): PermissionConfig {
  const config = createDefaultConfig();
  if (!input || typeof input !== "object") return config;
  const raw = input as Record<string, any>;
  config.djRoles = stringList(raw.djRoles);
  const groups = raw.groups && typeof raw.groups === "object" ? raw.groups : {};
  for (const group of GROUPS) {
    const r = groups[group];
    if (!r || typeof r !== "object") continue;
    config.groups[group] = {
      mode: (GROUP_MODES as readonly string[]).includes(r.mode) ? r.mode : DEFAULT_MODES[group],
      allowRoles: stringList(r.allowRoles),
      denyRoles: stringList(r.denyRoles),
      allowUsers: stringList(r.allowUsers),
      denyUsers: stringList(r.denyUsers)
    };
  }
  const options = raw.options && typeof raw.options === "object" ? raw.options : {};
  if (typeof options.requesterCanSkipOwn === "boolean") config.options.requesterCanSkipOwn = options.requesterCanSkipOwn;
  if (typeof options.aloneIsDj === "boolean") config.options.aloneIsDj = options.aloneIsDj;
  if (options.voteSkip && typeof options.voteSkip === "object") {
    if (typeof options.voteSkip.enabled === "boolean") config.options.voteSkip.enabled = options.voteSkip.enabled;
    if (options.voteSkip.percentage != null) config.options.voteSkip.percentage = clampPercentage(options.voteSkip.percentage);
  }
  if (raw.instanceChannels && typeof raw.instanceChannels === "object") {
    for (const [instance, channels] of Object.entries(raw.instanceChannels)) {
      if (/^[1-9]\d?$/.test(instance)) config.instanceChannels[instance] = stringList(channels);
    }
  }
  return config;
}

/** Whether the server saved its own rules (otherwise they are derived from the legacy DJ role). */
export function hasSavedConfig(settings: LegacySettingsLike | null | undefined): boolean {
  const saved = settings?.permissionConfig;
  return Boolean(saved && typeof saved === "object" && Object.keys(saved as object).length > 0);
}

/** The configuration in force for a server: the saved one, or the legacy equivalent. */
export function resolveConfig(settings: LegacySettingsLike | null | undefined): PermissionConfig {
  return hasSavedConfig(settings) ? normalizeConfig(settings!.permissionConfig) : migrateFromLegacy(settings);
}

/**
 * Follow a change of the legacy single DJ role (/settings djrole, the old
 * settings form) in a saved configuration: the old role out, the new one in.
 */
export function replaceDjRole(config: PermissionConfig, oldRoleId: string | null | undefined, newRoleId: string | null): PermissionConfig {
  const kept = config.djRoles.filter((id) => id !== oldRoleId);
  return { ...config, djRoles: newRoleId && !kept.includes(newRoleId) ? [...kept, newRoleId] : kept };
}

// ----------------------------------------------------------- validation

export const PERMISSION_LIMITS = {
  djRoles: 25,
  list: 100,
  instanceChannels: 50,
  maxInstance: 32
} as const;

export type ParseResult = { ok: true; config: PermissionConfig } | { ok: false; error: string; path: string };

/**
 * Strict validation of a configuration sent by a client (PUT /permissions):
 * every group present, modes known, ids are snowflakes, sizes bounded.
 * Duplicates are removed; nothing else is silently changed.
 */
export function parsePermissionConfig(input: unknown): ParseResult {
  const fail = (path: string, error: string): ParseResult => ({ ok: false, path, error });
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("", "Expected an object");
  const raw = input as Record<string, unknown>;

  const ids = (value: unknown, path: string, max: number): string[] | ParseResult => {
    if (!Array.isArray(value)) return fail(path, "Expected an array of ids");
    if (value.length > max) return fail(path, `At most ${max} entries`);
    for (let i = 0; i < value.length; i++) {
      if (!isSnowflake(value[i])) return fail(`${path}[${i}]`, "Not a Discord id");
    }
    return Array.from(new Set(value as string[]));
  };
  const isFail = (v: unknown): v is ParseResult => !Array.isArray(v);

  const djRoles = ids(raw.djRoles, "djRoles", PERMISSION_LIMITS.djRoles);
  if (isFail(djRoles)) return djRoles;

  if (!raw.groups || typeof raw.groups !== "object" || Array.isArray(raw.groups)) return fail("groups", "Expected an object");
  const rawGroups = raw.groups as Record<string, unknown>;
  for (const key of Object.keys(rawGroups)) {
    if (!(GROUPS as readonly string[]).includes(key)) return fail(`groups.${key}`, "Unknown group");
  }
  const groups = {} as Record<Group, GroupRule>;
  for (const group of GROUPS) {
    const r = rawGroups[group];
    if (!r || typeof r !== "object" || Array.isArray(r)) return fail(`groups.${group}`, "Missing group");
    const rule = r as Record<string, unknown>;
    if (!(GROUP_MODES as readonly string[]).includes(rule.mode as string)) {
      return fail(`groups.${group}.mode`, `Expected one of ${GROUP_MODES.join(", ")}`);
    }
    const lists = {} as Record<"allowRoles" | "denyRoles" | "allowUsers" | "denyUsers", string[]>;
    for (const name of ["allowRoles", "denyRoles", "allowUsers", "denyUsers"] as const) {
      const parsed = ids(rule[name] ?? [], `groups.${group}.${name}`, PERMISSION_LIMITS.list);
      if (isFail(parsed)) return parsed;
      lists[name] = parsed;
    }
    groups[group] = { mode: rule.mode as GroupMode, ...lists };
  }

  if (!raw.options || typeof raw.options !== "object" || Array.isArray(raw.options)) return fail("options", "Expected an object");
  const o = raw.options as Record<string, unknown>;
  if (typeof o.requesterCanSkipOwn !== "boolean") return fail("options.requesterCanSkipOwn", "Expected a boolean");
  if (typeof o.aloneIsDj !== "boolean") return fail("options.aloneIsDj", "Expected a boolean");
  const vs = o.voteSkip as Record<string, unknown> | undefined;
  if (!vs || typeof vs !== "object" || Array.isArray(vs)) return fail("options.voteSkip", "Expected an object");
  if (typeof vs.enabled !== "boolean") return fail("options.voteSkip.enabled", "Expected a boolean");
  if (typeof vs.percentage !== "number" || !Number.isInteger(vs.percentage) || vs.percentage < 1 || vs.percentage > 100) {
    return fail("options.voteSkip.percentage", "Expected a whole number from 1 to 100");
  }

  const instanceChannels: Record<string, string[]> = {};
  const rawInstances = raw.instanceChannels ?? {};
  if (typeof rawInstances !== "object" || Array.isArray(rawInstances)) return fail("instanceChannels", "Expected an object");
  for (const [instance, channels] of Object.entries(rawInstances as Record<string, unknown>)) {
    const n = Number(instance);
    if (!/^[1-9]\d?$/.test(instance) || n > PERMISSION_LIMITS.maxInstance) {
      return fail(`instanceChannels.${instance}`, `Instance must be 1-${PERMISSION_LIMITS.maxInstance}`);
    }
    const parsed = ids(channels, `instanceChannels.${instance}`, PERMISSION_LIMITS.instanceChannels);
    if (isFail(parsed)) return parsed;
    instanceChannels[instance] = parsed;
  }

  return {
    ok: true,
    config: {
      djRoles,
      groups,
      options: {
        requesterCanSkipOwn: o.requesterCanSkipOwn,
        aloneIsDj: o.aloneIsDj,
        voteSkip: { enabled: vs.enabled, percentage: vs.percentage }
      },
      instanceChannels
    }
  };
}

// ----------------------------------------------------------- evaluation

/**
 * May `member` use `group`? Order:
 * 1. admins always pass;
 * 2. deny lists (users, then roles) beat allow lists;
 * 3. allow lists (users, then roles);
 * 4. the group's mode (`everyone`; `dj` = a DJ role, or alone with the bot
 *    when `aloneIsDj`; `admins` = nobody else);
 * 5. escape hatch: the requester may skip/remove their own songs.
 */
export function evaluate(
  config: PermissionConfig,
  member: PermissionMember,
  group: Group,
  ctx: PermissionContext = {}
): PermissionResult {
  const rule = config.groups?.[group] ?? emptyRule(DEFAULT_MODES[group]);
  const mode = rule.mode;
  const result = (ok: boolean, reason: PermissionReason, source: RuleSource, roleId?: string): PermissionResult => ({
    ok,
    reason,
    rule: roleId ? { group, mode, source, roleId } : { group, mode, source }
  });

  if (member.isAdmin) return result(true, "admin", "admin");

  if (rule.denyUsers.includes(member.id)) return result(false, "denied_user", "denyUsers");
  const deniedRole = member.roleIds.find((id) => rule.denyRoles.includes(id));
  if (deniedRole) return result(false, "denied_role", "denyRoles", deniedRole);

  if (rule.allowUsers.includes(member.id)) return result(true, "allowed_user", "allowUsers");
  const allowedRole = member.roleIds.find((id) => rule.allowRoles.includes(id));
  if (allowedRole) return result(true, "allowed_role", "allowRoles", allowedRole);

  if (mode === "everyone") return result(true, "everyone", "mode");
  if (mode === "dj") {
    if (member.roleIds.some((id) => config.djRoles.includes(id))) return result(true, "dj", "mode");
    if (config.options?.aloneIsDj && ctx.aloneWithBot) return result(true, "alone", "aloneIsDj");
  }

  if (config.options?.requesterCanSkipOwn && ctx.isRequester && REQUESTER_GROUPS.includes(group)) {
    return result(true, "requester", "requesterCanSkipOwn");
  }

  return result(false, mode === "admins" ? "needs_admin" : "needs_dj", "mode");
}

/** Whether a voice channel may be served by a given bot instance ([] or absent = any channel). */
export function isChannelAllowedForInstance(config: PermissionConfig, instance: number | string, channelId: string): boolean {
  const allowed = config.instanceChannels?.[String(instance)];
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(channelId);
}

// ------------------------------------------------------ command mapping

/**
 * Action group of every slash command, context menu, player-panel button and
 * dashboard command. `null` = not permission-gated (read-only, personal, or
 * governed by its own rule: admin-only commands use Discord's default member
 * permissions; /voteskip uses `options.voteSkip`).
 */
export const COMMAND_GROUPS: Readonly<Record<string, Group | null>> = Object.freeze({
  // play: add songs
  play: "play",
  search: "play",
  play_file: "play",
  play_spotify: "play",
  playnext: "play",
  playnow: "play",
  radio: "play",
  "play in voice channel": "play",
  "play next": "play",
  // playback: pause/resume/seek/previous
  pause: "playback",
  resume: "playback",
  seek: "playback",
  previous: "playback",
  rewind: "playback",
  forward: "playback",
  replay: "playback",
  wind: "playback",
  toggle: "playback", // panel play/pause
  prev: "playback", // panel previous
  // skip
  skip: "skip",
  skipto: "skip",
  jump: "skip",
  // queue: remove/move/shuffle/clear
  remove: "queue",
  move: "queue",
  shuffle: "queue",
  clear: "queue",
  queuemanage: "queue",
  // volume
  volume: "volume",
  voldown: "volume", // panel
  volup: "volume", // panel
  // effects
  filter: "effects",
  effects: "effects",
  bassboost: "effects",
  nightcore: "effects",
  speed: "effects",
  setbitrate: "effects",
  resetbitrate: "effects",
  // loop / autoplay
  loop: "loop_autoplay",
  loopqueue: "loop_autoplay",
  repeat: "loop_autoplay",
  autoplay: "loop_autoplay",
  // stop / leave / join
  stop: "stop_leave",
  leave: "stop_leave",
  join: "stop_leave",
  // lyrics
  lyrics: "lyrics_view",
  // settings
  settings: "settings",
  // not gated
  voteskip: null,
  queue: null,
  nowplaying: null,
  grab: null,
  save: null,
  history: null,
  recentlyplayed: null,
  collections: null,
  playlist: null,
  guess: null,
  say: null,
  sayconfig: null,
  "247": null,
  language: null,
  rebind: null,
  commanddisable: null,
  commanddisableall: null,
  commandenable: null,
  commandenableall: null,
  help: null,
  info: null,
  invite: null,
  dashboard: null,
  patreon: null,
  perks: null,
  ping: null,
  premium: null,
  claim: null,
  transfer: null,
  stats: null,
  user: null,
  vote: null
});

/** The action group of a command, panel button or dashboard command; null when it is not gated or unknown. */
export function commandGroup(commandName: string): Group | null {
  const key = commandName.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(COMMAND_GROUPS, key) ? COMMAND_GROUPS[key] : null;
}

// ------------------------------------------------------------- wording

/** English names, for the dashboard (the bot uses its locale files). */
export const GROUP_LABELS: Readonly<Record<Group, string>> = Object.freeze({
  play: "Add songs",
  playback: "Pause, resume, seek and previous",
  skip: "Skip",
  queue: "Edit the queue",
  volume: "Volume",
  effects: "Audio effects",
  loop_autoplay: "Loop and autoplay",
  stop_leave: "Stop, leave and join",
  lyrics_view: "Lyrics",
  settings: "Server settings"
});

/** English explanation of a refusal, naming the rule and who can change it. */
export function describeDenial(result: PermissionResult): string {
  const label = GROUP_LABELS[result.rule.group];
  const tail = "Server admins can change this on the dashboard.";
  switch (result.reason) {
    case "denied_user":
      return `You are on the deny list for "${label}". ${tail}`;
    case "denied_role":
      return `One of your roles is on the deny list for "${label}". ${tail}`;
    case "needs_admin":
      return `"${label}" is limited to server admins. ${tail}`;
    case "needs_dj":
      return `"${label}" is limited to DJs. ${tail}`;
    default:
      return "";
  }
}
