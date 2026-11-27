import {
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  Guild,
  GuildTextBasedChannel,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorSpacingSize
} from "discord.js";
import { configuredInstances, inviteUrl } from "../shared/fleet";
import { botInviteUrl, SITE_URL, SUPPORT_INVITE_URL } from "../shared/links";
import { mention } from "../structs/commandRegistry";
import { localeForGuild } from "../utils/guildLocale";
import { currentLocale, i18n, runWithLocale } from "../utils/i18n";

/**
 * First-run message when the bot joins a server: how to start, where the
 * controls are, and where to get help. Posted once, in the system channel or
 * the first channel the bot may write in. Never pings anyone.
 */
function pickChannel(guild: Guild): GuildTextBasedChannel | null {
  const me = guild.members.me;
  if (!me) return null;
  const canPost = (channel: GuildTextBasedChannel) =>
    channel
      .permissionsFor(me)
      ?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]) ?? false;

  if (guild.systemChannel && canPost(guild.systemChannel)) return guild.systemChannel;

  const candidates = guild.channels.cache
    .filter((c): c is GuildTextBasedChannel => c.type === ChannelType.GuildText)
    .sort((a, b) => ("position" in a && "position" in b ? (a as any).position - (b as any).position : 0));

  const preferred = candidates.find((c) => /general|chat|music|bot|musica|música/i.test(c.name) && canPost(c));
  return preferred ?? candidates.find(canPost) ?? null;
}

export interface WelcomeOptions {
  /** The bot lacks Set Voice Channel Status (invited with an older link). */
  missingVoiceStatus?: boolean;
  /** Re-authorization link for this server (defaults to the generic invite). */
  inviteUrl?: string;
  /** The other Bypass bots this server can add, with invite links for it. */
  fleet?: { name: string; url: string }[];
}

/** Bypass 2-4 with invite links pre-selecting `guildId`: what a new server can add next. */
export function fleetInvites(guildId?: string): { name: string; url: string }[] {
  return configuredInstances()
    .filter((m) => m.instance > 1 && !m.premium)
    .map((m) => ({ name: m.name, url: inviteUrl(m.instance, guildId) }))
    .filter((m): m is { name: string; url: string } => Boolean(m.url));
}

/** "Bypass 2, Bypass 3 and Bypass 4" in the current language. */
function joinNames(names: string[]): string {
  try {
    return new Intl.ListFormat(currentLocale(), { style: "long", type: "conjunction" }).format(names);
  } catch {
    return names.join(", ");
  }
}

export function buildWelcome(botName: string, options: WelcomeOptions = {}): ContainerBuilder {
  const tips = [
    `-# ${i18n
      .__("welcome.tips")
      .replace("**/help**", mention("help"))
      .replace("**/settings**", mention("settings"))
      .replace("**/autoplay**", mention("autoplay"))}`
  ];
  if (options.missingVoiceStatus) {
    tips.push(`-# 🔑 ${i18n.__mf("welcome.voiceStatusHint", { url: options.inviteUrl ?? botInviteUrl() })}`);
  }

  const container = new ContainerBuilder()
    .setAccentColor(0xf8aa2a)
    .addTextDisplayComponents((t) => t.setContent(`## 🎶 ${i18n.__mf("welcome.title", { bot: botName })}`))
    .addTextDisplayComponents((t) =>
      t.setContent(i18n.__("welcome.body").replace("**/play**", `**${mention("play")}**`))
    )
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) => t.setContent(tips.join("\n")))
    .addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder().setCustomId("help:open").setEmoji("📖").setLabel(i18n.__("welcome.commands")).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setURL(SITE_URL).setEmoji("🎛️").setLabel(i18n.__("welcome.dashboard")).setStyle(ButtonStyle.Link),
        new ButtonBuilder().setURL(SUPPORT_INVITE_URL).setEmoji("💬").setLabel(i18n.__("welcome.support")).setStyle(ButtonStyle.Link)
      )
    );

  // Music in several voice channels at once needs the other Bypass bots: offer them right away.
  const fleet = (options.fleet ?? []).slice(0, 5);
  if (fleet.length) {
    container
      .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents((t) =>
        t.setContent(`➕ ${i18n.__mf("welcome.fleet", { bots: joinNames(fleet.map((f) => `**${f.name}**`)) })}`)
      )
      .addActionRowComponents((row) =>
        row.setComponents(
          fleet.map((f) => new ButtonBuilder().setURL(f.url).setLabel(i18n.__mf("fleet.dispatch.add", { bot: f.name })).setStyle(ButtonStyle.Link))
        )
      );
  }
  return container;
}

export async function sendWelcome(guild: Guild): Promise<void> {
  try {
    const channel = pickChannel(guild);
    if (!channel) return;
    const locale = await localeForGuild(guild);
    // Shown only when the invite left out Set Voice Channel Status ("♪ Song" under the channel name).
    const missingVoiceStatus = !(guild.members.me?.permissions.has(PermissionFlagsBits.SetVoiceChannelStatus) ?? true);
    const container = runWithLocale(locale, () =>
      buildWelcome(guild.client.user.username, {
        missingVoiceStatus,
        inviteUrl: botInviteUrl(guild.client.user.id, guild.id),
        fleet: fleetInvites(guild.id)
      })
    );
    await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    console.log(`[Welcome] Sent onboarding to ${guild.name} #${channel.name}`);
  } catch (error) {
    console.warn(`[Welcome] Could not send onboarding to ${guild.id}:`, (error as Error)?.message ?? error);
  }
}
