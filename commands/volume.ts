import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription(i18n.__("volume.description"))
    .addIntegerOption((option) => option.setName("volume").setDescription(i18n.__("volume.description"))),
  async execute(interaction: ChatInputCommandInteraction) {
    // Defer reply immediately to prevent interaction timeout
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);
    const volumeArg = interaction.options.getInteger("volume");

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("volume.errorNotChannel") }).catch(console.error);
    }

    // Check DJ permission
    const hasDJ = await hasDJPermission(guildMember as GuildMember);
    if (!hasDJ) {
      return interaction.editReply({ 
        content: "❌ You need the DJ role to use this command."
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue) {
      return interaction.editReply({ content: i18n.__("volume.errorNotQueue") }).catch(console.error);
    }

    if (!volumeArg) {
      return interaction.editReply({ content: i18n.__mf("volume.currentVolume", { volume: queue.node.volume }) }).catch(console.error);
    }

    if (isNaN(volumeArg)) {
      return interaction.editReply({ content: i18n.__("volume.errorNotNumber") }).catch(console.error);
    }

    // Get max volume from guild settings
    const settings = await GuildSettingsService.getInstance().getSettings(interaction.guild!.id);
    const maxVolume = settings.maxVolume;

    if (volumeArg > maxVolume || volumeArg < 0) {
      return interaction.editReply({ 
        content: `❌ Volume must be between 0 and ${maxVolume}.`
      }).catch(console.error);
    }

    const oldVolume = queue.node.volume;
    queue.node.setVolume(volumeArg);
    
    // Log the action
    await logAction(interaction.guild!, interaction.user, "volume_change", `${oldVolume}% → ${volumeArg}%`);
    
    return interaction.editReply({ content: i18n.__mf("volume.result", { arg: volumeArg }) }).catch(console.error);
  }
};
