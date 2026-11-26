import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder
} from "discord.js";
import { botInviteUrl, SITE_URL, SUPPORT_INVITE_URL } from "../shared/links";
import { i18n } from "../utils/i18n";

/** /invite — add the bot to another server (works anywhere, also user-installed). */
export default {
  data: new SlashCommandBuilder().setName("invite").setDescription(i18n.__("invite.description")),
  category: "other",
  userInstallable: true,
  execute(interaction: ChatInputCommandInteraction) {
    const container = new ContainerBuilder()
      .setAccentColor(0xf8aa2a)
      .addTextDisplayComponents((t) => t.setContent(`### ➕ ${i18n.__mf("Invite me to your server!")}`))
      .addActionRowComponents((row) =>
        row.setComponents(
          new ButtonBuilder().setLabel(i18n.__mf("Invite")).setStyle(ButtonStyle.Link).setURL(botInviteUrl(interaction.client.user!.id)),
          new ButtonBuilder().setLabel(i18n.__("links.website")).setStyle(ButtonStyle.Link).setURL(SITE_URL),
          new ButtonBuilder().setLabel(i18n.__("links.support")).setStyle(ButtonStyle.Link).setURL(SUPPORT_INVITE_URL)
        )
      );
    return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(console.error);
  }
};
