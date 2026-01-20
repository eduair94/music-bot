import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("8d")
    .setDescription("Apply 8D audio effect (rotates sound around you)")
    .addBooleanOption((option) =>
      option.setName("enabled").setDescription("Enable or disable 8D effect").setRequired(false)
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

    const enabled = interaction.options.getBoolean("enabled");
    const currentFilters = queue.filters.ffmpeg.getFiltersEnabled();
    const isCurrentlyEnabled = currentFilters.includes("8D");
    const shouldEnable = enabled !== null ? enabled : !isCurrentlyEnabled;

    if (shouldEnable !== isCurrentlyEnabled) {
      await queue.filters.ffmpeg.toggle(["8D"]);
    }

    await logAction(interaction.guild!, interaction.user, "setting_change", `8D ${shouldEnable ? "On" : "Off"}`);

    return interaction.editReply({
      content: `<@${interaction.user.id}> 🎧 8D audio is now ${shouldEnable ? "**enabled**" : "**disabled**"}`
    }).catch(console.error);
  }
};
