import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("bassboost")
    .setDescription(i18n.__("bassboost.description"))
    .addStringOption((option) =>
      option
        .setName("level")
        .setDescription("Bass boost level")
        .setRequired(false)
        .addChoices(
          { name: "Off", value: "off" },
          { name: "Low", value: "low" },
          { name: "Medium", value: "medium" },
          { name: "High", value: "high" }
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    const hasDJ = await hasDJPermission(guildMember as GuildMember);
    if (!hasDJ) {
      return interaction.editReply({ 
        content: "❌ You need the DJ role to use this command."
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: i18n.__("bassboost.errorNotQueue") }).catch(console.error);
    }

    const level = interaction.options.getString("level") || "medium";
    
    // Clear any existing bass boost filters first
    const currentFilters = queue.filters.ffmpeg.getFiltersEnabled();
    if (currentFilters.includes("bassboost")) {
      await queue.filters.ffmpeg.toggle(["bassboost"]);
    }
    
    if (level === "off") {
      await logAction(interaction.guild!, interaction.user, "setting_change", "Bass boost Off");
      return interaction.editReply({ 
        content: i18n.__mf("bassboost.result", { level: "Off", author: interaction.user.id })
      }).catch(console.error);
    }
    
    // Apply bass boost
    await queue.filters.ffmpeg.toggle(["bassboost"]);
    
    await logAction(interaction.guild!, interaction.user, "setting_change", `Bass boost ${level}`);
    
    return interaction.editReply({ 
      content: i18n.__mf("bassboost.result", { level: level.charAt(0).toUpperCase() + level.slice(1), author: interaction.user.id })
    }).catch(console.error);
  }
};
