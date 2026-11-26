import { ApplicationCommandType, ContextMenuCommandBuilder, Message, MessageContextMenuCommandInteraction, MessageFlags } from "discord.js";
import { ContextMenuCommand } from "../interfaces/Command";
import { i18n } from "../utils/i18n";
import { runPlay } from "../utils/playFlow";

/**
 * What to play from a message: the first link, else an audio/video
 * attachment, else an embed's link, else the text itself as a search.
 */
export function queryFromMessage(message: Message): string | null {
  const url = message.content.match(/https?:\/\/[^\s<>]+/i)?.[0];
  if (url) return url;
  const media = message.attachments.find((a) => /^(audio|video)\//.test(a.contentType ?? "") || /\.(mp3|ogg|wav|flac|m4a|webm|mp4|opus)$/i.test(a.name));
  if (media) return media.url;
  const embedUrl = message.embeds.find((e) => e.url)?.url;
  if (embedUrl) return embedUrl;
  const text = message.content.replace(/<[@#:&!a-z0-9_]+>/gi, "").trim();
  return text.length >= 2 ? text.slice(0, 200) : null;
}

export async function playFromMessage(interaction: MessageContextMenuCommandInteraction, next: boolean) {
  if (!interaction.inCachedGuild()) return;
  const query = queryFromMessage(interaction.targetMessage);
  if (!query) {
    return interaction.reply({ content: `🤷 ${i18n.__("play.contextNoQuery")}`, flags: MessageFlags.Ephemeral });
  }
  return runPlay({ interaction, query, next, ephemeral: true });
}

const command: ContextMenuCommand = {
  data: new ContextMenuCommandBuilder().setName("Play in voice channel").setType(ApplicationCommandType.Message),
  cooldown: 2,
  execute: (interaction) => playFromMessage(interaction as MessageContextMenuCommandInteraction, false)
};

export default command;
