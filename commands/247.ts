import {
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel
} from "discord.js";
import { GuildSettingsService } from "../services/guildSettings";
import { PlayerPanelService } from "../services/playerPanel";
import { Stay247Service } from "../services/stay247";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";
import { requirePremiumFeature } from "../utils/premiumCheck";
import { handStay247, servingInstance } from "../services/fleet/dispatcher";
import { stay247Of } from "../utils/instance";
import { listenersElsewhere } from "../utils/playFlow";

/**
 * /247 — keep the bot in its voice channel (also through restarts).
 * Founder perk, or 12 h with a vote. Turning it off is always allowed.
 */
export default {
  data: new SlashCommandBuilder()
    .setName("247")
    .setDescription(i18n.__("247.description"))
    .addBooleanOption((option) => option.setName("enabled").setDescription(i18n.__("common.optionToggle")))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  category: "music",

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const member = interaction.member as GuildMember;
    const settings = await GuildSettingsService.getInstance().getSettings(interaction.guildId);

    // Fleet: another Bypass instance plays in the member's channel; 24/7 is its own.
    const instance = await servingInstance(interaction);
    if (instance) {
      const on = interaction.options.getBoolean("enabled") ?? !stay247Of(settings, instance)?.enabled;
      if (on && !(await requirePremiumFeature(interaction, "stay_24_7"))) return;
      return handStay247(interaction, instance, on);
    }

    const enabled = interaction.options.getBoolean("enabled") ?? !stay247Of(settings)?.enabled;
    const service = Stay247Service.getInstance();

    if (!enabled) {
      await service.disable(interaction.guild);
      const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
      if (queue && !queue.deleted) PlayerPanelService.getInstance().refresh(queue, true);
      return interaction.reply({
        content: `🌙 ${i18n.__mf("stay247.disabledNow", { minutes: Math.round((settings.autoLeaveTimeout ?? 300) / 60) })}`
      });
    }

    // Premium gate: replies with the Founder/vote offer when the user lacks it
    if (!(await requirePremiumFeature(interaction, "stay_24_7"))) return;

    const voice = member.voice.channel ?? interaction.guild.members.me?.voice.channel ?? null;
    if (!voice) {
      return interaction.reply({ content: `🔇 ${i18n.__("stay247.needVoice")}`, flags: MessageFlags.Ephemeral });
    }
    // Never move the bot (now or after a restart) away from people listening elsewhere.
    const busyIn = listenersElsewhere(interaction.guild, voice.id);
    if (busyIn) {
      return interaction.reply({ content: `🎧 ${i18n.__mf("play.botNotInChannel", { channel: `<#${busyIn.id}>` })}`, flags: MessageFlags.Ephemeral });
    }

    const channel = interaction.channel;
    const text = channel && channel.type === ChannelType.GuildText ? (channel as TextChannel) : null;
    await interaction.deferReply();
    await service.enable(interaction.guild, voice, text, interaction.user.id);
    const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
    if (queue && !queue.deleted) PlayerPanelService.getInstance().refresh(queue, true);
    return interaction.editReply({ content: `🌙 ${i18n.__mf("stay247.enabledHere", { channel: `<#${voice.id}>` })}` });
  }
};
