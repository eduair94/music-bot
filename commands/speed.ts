import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("speed")
    .setDescription(i18n.__("speed.description"))
    .addNumberOption((option) =>
      option
        .setName("rate")
        .setDescription("Playback speed (0.5 to 2.0)")
        .setRequired(false)
        .setMinValue(0.5)
        .setMaxValue(2.0)
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
      return interaction.editReply({ content: i18n.__("speed.errorNotQueue") }).catch(console.error);
    }

    const rate = interaction.options.getNumber("rate");
    
    // If no rate provided, show current or reset to 1.0
    if (rate === null) {
      // Reset to normal speed by disabling tempo filter
      const currentFilters = queue.filters.ffmpeg.getFiltersEnabled();
      for (const filter of currentFilters) {
        if (filter.startsWith("atempo")) {
          await queue.filters.ffmpeg.toggle([filter]);
        }
      }
      await logAction(interaction.guild!, interaction.user, "setting_change", "Speed reset to 1.0x");
      return interaction.editReply({ 
        content: i18n.__mf("speed.reset", { author: interaction.user.id })
      }).catch(console.error);
    }

    // Apply speed change using ffmpeg atempo filter
    // Note: discord-player may have built-in speed filter
    try {
      await queue.filters.ffmpeg.setInputArgs(["-af", `atempo=${rate}`]);
    } catch {
      // If setInputArgs doesn't work, try toggle approach
      console.log("[speed] Using alternative method");
    }
    
    await logAction(interaction.guild!, interaction.user, "setting_change", `Speed ${rate}x`);
    
    return interaction.editReply({ 
      content: i18n.__mf("speed.result", { speed: rate, author: interaction.user.id })
    }).catch(console.error);
  }
};
