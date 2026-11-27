import type { Track } from "discord-player";
import {
  BaseInteraction,
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  RepliableInteraction
} from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import {
  Group,
  PermissionConfig,
  PermissionContext,
  PermissionResult,
  commandGroup,
  evaluate,
  resolveConfig
} from "../shared/permissions";
import { i18n } from "./i18n";

/**
 * The one permission gate for slash commands, context menus and player
 * buttons: the server's rule for an action group (shared/permissions.ts),
 * evaluated with the member's live roles. The dashboard API evaluates the
 * same rules through dashboard/src/lib/guild-access.ts.
 */

export type PermissionSubject = GuildMember | BaseInteraction;

function memberOf(subject: PermissionSubject): GuildMember | null {
  if (subject instanceof GuildMember) return subject;
  if (subject.member instanceof GuildMember) return subject.member;
  return subject.guild?.members.cache.get(subject.user.id) ?? null;
}

/** Server owner, Manage Server / Administrator, or the admin role from /settings. */
export function isServerAdmin(member: GuildMember, adminRoleId: string | null | undefined): boolean {
  if (member.guild.ownerId === member.id) return true;
  // has() counts Administrator as every permission.
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return Boolean(adminRoleId && member.roles.cache.has(adminRoleId));
}

/** The member is the only person (bots aside) in the bot's voice channel. */
export function isAloneWithBot(member: GuildMember): boolean {
  const botChannel = member.guild.members.me?.voice.channel;
  if (!botChannel || member.voice.channelId !== botChannel.id) return false;
  return botChannel.members.filter((m) => !m.user.bot).size === 1;
}

/** The member asked for this song. */
export function isRequesterOf(track: Track | null | undefined, userId: string): boolean {
  return Boolean(track?.requestedBy?.id && track.requestedBy.id === userId);
}

/** The rules in force for a server (saved, or derived from the legacy DJ role). */
export async function permissionConfigFor(guildId: string): Promise<PermissionConfig> {
  return resolveConfig(await GuildSettingsService.getInstance().getSettings(guildId));
}

/**
 * May this member (or the member behind this interaction) use `group`?
 * `aloneWithBot` is worked out here unless the caller passes it.
 */
export async function canUse(subject: PermissionSubject, group: Group, ctx: PermissionContext = {}): Promise<PermissionResult> {
  const member = memberOf(subject);
  if (!member) {
    // Outside a cached guild there are no roles to check: only "everyone" groups pass.
    return evaluate(resolveConfig(null), { id: (subject as BaseInteraction).user?.id ?? "0", roleIds: [], isAdmin: false }, group, ctx);
  }
  const settings = await GuildSettingsService.getInstance().getSettings(member.guild.id);
  const config = resolveConfig(settings);
  return evaluate(
    config,
    { id: member.id, roleIds: member.roles.cache.map((role) => role.id), isAdmin: isServerAdmin(member, settings.adminRoleId) },
    group,
    { aloneWithBot: ctx.aloneWithBot ?? isAloneWithBot(member), isRequester: ctx.isRequester }
  );
}

/** Localized refusal naming the rule that blocked and who can change it. */
export function denialMessage(result: PermissionResult): string {
  const group = i18n.__(`permissions.groups.${result.rule.group}`);
  const key = result.reason === "denied_user" || result.reason === "denied_role" || result.reason === "needs_admin" ? result.reason : "needs_dj";
  return `🔒 ${i18n.__mf(`permissions.deny.${key}`, { group })} ${i18n.__("permissions.deny.hint")}`;
}

/**
 * Check `group` for the member behind an interaction; on refusal reply
 * privately and return false. Call before deferring a public reply: a public
 * defer cannot become private.
 */
export async function gate(
  interaction: RepliableInteraction,
  group: Group,
  ctx: PermissionContext = {}
): Promise<boolean> {
  const result = await canUse(interaction, group, ctx);
  if (result.ok) return true;
  const payload = { content: denialMessage(result), flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload as any);
    else await interaction.reply(payload as any);
  } catch (error) {
    console.warn("[permissions] Could not send refusal:", (error as Error)?.message ?? error);
  }
  return false;
}

/** Commands that check their own group with per-call context (which songs they target). */
const SELF_GATED = new Set(["remove", "voteskip"]);

/**
 * Slash-command groups that differ from the shared table: /join only joins
 * when the bot is idle (it never moves it away from listeners), like /play.
 */
const SLASH_GROUP_OVERRIDES: Record<string, Group | null> = { join: "play" };

/** The group a slash command or context menu is checked against by the router; null = not gated there. */
export function slashCommandGroup(commandName: string): Group | null {
  if (SELF_GATED.has(commandName)) return null;
  if (Object.prototype.hasOwnProperty.call(SLASH_GROUP_OVERRIDES, commandName)) return SLASH_GROUP_OVERRIDES[commandName];
  return commandGroup(commandName);
}

/**
 * Router check for slash commands and context menus (structs/Bot.ts). Returns
 * the refusal to send privately, or null when the member may go ahead.
 */
export async function commandGate(interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction): Promise<string | null> {
  if (!interaction.inCachedGuild()) return null;
  const group = slashCommandGroup(interaction.commandName);
  if (!group) return null;
  const ctx: PermissionContext = {};
  if (interaction.commandName === "skip") {
    const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
    ctx.isRequester = isRequesterOf(queue?.currentTrack, interaction.user.id);
  }
  const result = await canUse(interaction, group, ctx);
  return result.ok ? null : denialMessage(result);
}
