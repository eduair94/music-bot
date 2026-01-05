import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("pitch")
    .setDescription("Change the pitch of the current track")
    .addStringOption((option) =>
      option
        .setName("level")
        .setDescription("Pitch level")
        .setRequired(false)
        .addChoices(
          { name: "Off", value: "off" },
          { name: "Lower (vaporwave)", value: "lower" },
          { name: "Higher (nightcore)", value: "higher" }
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
      return interaction.editReply({ content: "❌ There is nothing playing." }).catch(console.error);
    }

    const level = interaction.options.getString("level") || "higher";
    
    // Clear existing pitch-related filters (nightcore and vaporwave)
    const currentFilters = queue.filters.ffmpeg.getFiltersEnabled();
    if (currentFilters.includes("nightcore")) {
      await queue.filters.ffmpeg.toggle(["nightcore"]);
    }
    if (currentFilters.includes("vaporwave")) {
      await queue.filters.ffmpeg.toggle(["vaporwave"]);
    }
    
    if (level === "off") {
      await logAction(interaction.guild!, interaction.user, "setting_change", "Pitch Off");
      return interaction.editReply({
        content: `<@${interaction.user.id}> 🎵 Pitch effect **disabled**`
      }).catch(console.error);
    }

    // Use nightcore for higher pitch, vaporwave for lower pitch
    const filterName = level === "higher" ? "nightcore" : "vaporwave";
    await queue.filters.ffmpeg.toggle([filterName]);

    const levelDisplay = level === "higher" ? "Higher (Nightcore)" : "Lower (Vaporwave)";
    await logAction(interaction.guild!, interaction.user, "setting_change", `Pitch ${levelDisplay}`);

    return interaction.editReply({
      content: `<@${interaction.user.id}> 🎵 Pitch set to **${levelDisplay}**`
    }).catch(console.error);
  }
};
