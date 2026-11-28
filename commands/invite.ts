import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder
} from "discord.js";
import { referralCount } from "../services/growth/acquisition";
import { referralRef } from "../services/growth/logic";
import { VOTE_PERK_HOURS } from "../services/votes";
import { fleetInvites } from "../services/welcome";
import { botSiteLink, trackedInviteUrl } from "../shared/growth";
import { botInviteUrl, SITE_URL, SUPPORT_INVITE_URL } from "../shared/links";
import { i18n } from "../utils/i18n";
import { isLinked, isPrimary } from "../utils/instance";

/**
 * /invite — add the bot to another server (works anywhere, also user-installed).
 * On Bypass the Invite button is the caller's personal referral link
 * (`/invite?ref=u-<id>` on the site): servers it brings are credited to them
 * and earn them vote perks (services/growth/acquisition.ts). Private bots
 * keep their own direct invite.
 */
export default {
  data: new SlashCommandBuilder().setName("invite").setDescription(i18n.__("invite.description")),
  category: "other",
  userInstallable: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.inGuild() ? interaction.guildId : undefined;
    const inviteLink = isPrimary
      ? trackedInviteUrl(SITE_URL, referralRef(interaction.user.id))
      : botInviteUrl(interaction.client.user!.id);
    const container = new ContainerBuilder()
      .setAccentColor(0xf8aa2a)
      .addTextDisplayComponents((t) => t.setContent(`### ➕ ${i18n.__mf("Invite me to your server!")}`));

    if (isPrimary) {
      const brought = await referralCount(interaction.user.id);
      const line =
        brought > 0
          ? i18n.__mf("growth.invite.referrals", { count: brought, hours: VOTE_PERK_HOURS })
          : i18n.__mf("growth.invite.personal", { hours: VOTE_PERK_HOURS });
      container.addTextDisplayComponents((t) => t.setContent(`-# 🤝 ${line}`));
    }

    container.addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder().setLabel(i18n.__mf("Invite")).setStyle(ButtonStyle.Link).setURL(inviteLink),
        new ButtonBuilder().setLabel(i18n.__("links.website")).setStyle(ButtonStyle.Link).setURL(botSiteLink(SITE_URL, "/", "invite")),
        new ButtonBuilder().setLabel(i18n.__("links.support")).setStyle(ButtonStyle.Link).setURL(SUPPORT_INVITE_URL)
      )
    );

    // Bypass 2-4 play in other voice channels at the same time (not offered by private bots).
    const fleet = isLinked ? [] : fleetInvites(guildId).slice(0, 5);
    if (fleet.length) {
      container
        .addTextDisplayComponents((t) => t.setContent(`-# ${i18n.__("invite.fleet")}`))
        .addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) =>
          row.setComponents(
            fleet.map((f) => new ButtonBuilder().setLabel(i18n.__mf("fleet.dispatch.add", { bot: f.name })).setStyle(ButtonStyle.Link).setURL(f.url))
          )
        );
    }
    return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 }).catch(console.error);
  }
};
