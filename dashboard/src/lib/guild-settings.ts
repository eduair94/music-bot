import "server-only";
import {
  hasSavedConfig,
  normalizeConfig,
  replaceDjRole,
  type PermissionConfig
} from "../../../shared/permissions";
import type { GuildAccess } from "./guild-access";
import { summarizeChanges, writeGuildAudit } from "./guild-audit";
import { GuildSettingsModel } from "./models/GuildSettings";
import { publishSettingsChanged } from "./settings-bus";
import { validateSettingsPatch } from "./settings-schema";

/**
 * Settings and permission writes from the dashboard: validated, partial
 * ($set of changed fields only, never the counters), then the bot is told
 * to drop its cache and the change is audited.
 */

type SettingsDoc = Record<string, unknown>;

function serialize(doc: SettingsDoc): SettingsDoc {
  const rest = { ...doc };
  delete rest.__v;
  return rest;
}

/** The stored document, or the defaults for a server that never saved settings. */
export function settingsDocument(access: GuildAccess): SettingsDoc {
  if (access.settings) return serialize(access.settings);
  const defaults = new GuildSettingsModel({ guildId: access.guildId }).toObject() as SettingsDoc;
  delete defaults._id;
  return serialize(defaults);
}

export type PatchOutcome =
  | { ok: true; settings: SettingsDoc; changed: string[] }
  | { ok: false; errors: Record<string, string> };

/**
 * Apply a partial settings write. `strict` refuses read-only and unknown
 * fields (PATCH /settings); lenient mode ignores them (the legacy form posts
 * the whole document).
 */
export async function applySettingsPatch(access: GuildAccess, body: unknown, options: { strict: boolean }): Promise<PatchOutcome> {
  const current = access.settings;
  const result = validateSettingsPatch(body, current, options);
  if (!result.ok) return { ok: false, errors: result.errors };

  const updates: Record<string, unknown> = { ...result.updates };
  // Saved permission rules follow the legacy DJ role and vote-skip share.
  if (hasSavedConfig(current) && ("djRoleId" in updates || "voteSkipPercentage" in updates)) {
    let config = normalizeConfig(current!.permissionConfig);
    if ("djRoleId" in updates) config = replaceDjRole(config, current?.djRoleId as string | null, updates.djRoleId as string | null);
    if ("voteSkipPercentage" in updates) {
      config = { ...config, options: { ...config.options, voteSkip: { ...config.options.voteSkip, percentage: updates.voteSkipPercentage as number } } };
    }
    updates.permissionConfig = config;
  }

  const changed = Object.keys(updates);
  if (changed.length === 0) return { ok: true, settings: settingsDocument(access), changed };

  const saved = (await GuildSettingsModel.findOneAndUpdate(
    { guildId: access.guildId },
    { $set: updates },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean()) as SettingsDoc;

  await publishSettingsChanged(access.guildId, changed);
  await writeGuildAudit(access, "settings.update", summarizeChanges(current, result.updates));
  return { ok: true, settings: serialize(saved), changed };
}

/** Save a validated permission configuration (keeps the legacy DJ role and vote-skip share in step). */
export async function savePermissionConfig(access: GuildAccess, config: PermissionConfig): Promise<void> {
  const updates = {
    permissionConfig: config,
    djRoleId: config.djRoles[0] ?? null,
    voteSkipPercentage: config.options.voteSkip.percentage
  };
  await GuildSettingsModel.findOneAndUpdate({ guildId: access.guildId }, { $set: updates }, { upsert: true, setDefaultsOnInsert: true });
  await publishSettingsChanged(access.guildId, Object.keys(updates));
  await writeGuildAudit(access, "permissions.update", summarizePermissionChange(access.config, config));
}

/** Human summary of what changed between two configurations. */
export function summarizePermissionChange(before: PermissionConfig, after: PermissionConfig): string {
  const parts: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (!same([...before.djRoles].sort(), [...after.djRoles].sort())) parts.push(`DJ roles ${before.djRoles.length} → ${after.djRoles.length}`);
  for (const group of Object.keys(after.groups) as (keyof PermissionConfig["groups"])[]) {
    const a = before.groups[group];
    const b = after.groups[group];
    if (a.mode !== b.mode) parts.push(`${group}: ${a.mode} → ${b.mode}`);
    const lists = ["allowRoles", "denyRoles", "allowUsers", "denyUsers"] as const;
    const changedLists = lists.filter((l) => !same([...a[l]].sort(), [...b[l]].sort()));
    if (changedLists.length) parts.push(`${group}: ${changedLists.join(", ")} updated`);
  }
  const o1 = before.options;
  const o2 = after.options;
  const onOff = (v: boolean) => (v ? "on" : "off");
  if (o1.requesterCanSkipOwn !== o2.requesterCanSkipOwn) parts.push(`requester skips own ${onOff(o1.requesterCanSkipOwn)} → ${onOff(o2.requesterCanSkipOwn)}`);
  if (o1.aloneIsDj !== o2.aloneIsDj) parts.push(`alone counts as DJ ${onOff(o1.aloneIsDj)} → ${onOff(o2.aloneIsDj)}`);
  if (o1.voteSkip.enabled !== o2.voteSkip.enabled) parts.push(`vote-skip ${onOff(o1.voteSkip.enabled)} → ${onOff(o2.voteSkip.enabled)}`);
  if (o1.voteSkip.percentage !== o2.voteSkip.percentage) parts.push(`vote-skip ${o1.voteSkip.percentage}% → ${o2.voteSkip.percentage}%`);
  if (!same(before.instanceChannels, after.instanceChannels)) parts.push("bot channel scopes updated");
  return parts.length ? parts.join("; ") : "Saved without changes";
}
