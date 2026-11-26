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
import { SITE_URL, SUPPORT_INVITE_URL } from "../shared/links";
import { mention } from "../structs/commandRegistry";
import { localeForGuild } from "../utils/guildLocale";
import { i18n, runWithLocale } from "../utils/i18n";

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

export function buildWelcome(botName: string): ContainerBuilder {
  return new ContainerBuilder()
    .setAccentColor(0xf8aa2a)
    .addTextDisplayComponents((t) => t.setContent(`## 🎶 ${i18n.__mf("welcome.title", { bot: botName })}`))
    .addTextDisplayComponents((t) =>
      t.setContent(i18n.__("welcome.body").replace("**/play**", `**${mention("play")}**`))
    )
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) =>
      t.setContent(
        `-# ${i18n
          .__("welcome.tips")
          .replace("**/help**", mention("help"))
          .replace("**/settings**", mention("settings"))
          .replace("**/autoplay**", mention("autoplay"))}`
      )
    )
    .addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder().setCustomId("help:open").setEmoji("📖").setLabel(i18n.__("welcome.commands")).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setURL(SITE_URL).setEmoji("🎛️").setLabel(i18n.__("welcome.dashboard")).setStyle(ButtonStyle.Link),
        new ButtonBuilder().setURL(SUPPORT_INVITE_URL).setEmoji("💬").setLabel(i18n.__("welcome.support")).setStyle(ButtonStyle.Link)
      )
    );
}

export async function sendWelcome(guild: Guild): Promise<void> {
  try {
    const channel = pickChannel(guild);
    if (!channel) return;
    const locale = await localeForGuild(guild);
    const container = runWithLocale(locale, () => buildWelcome(guild.client.user.username));
    await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
    console.log(`[Welcome] Sent onboarding to ${guild.name} #${channel.name}`);
  } catch (error) {
    console.warn(`[Welcome] Could not send onboarding to ${guild.id}:`, (error as Error)?.message ?? error);
  }
}
