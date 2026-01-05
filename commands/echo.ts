import { AudioFilters } from "discord-player";
import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

// Define echo filter if not already defined
if (!AudioFilters.has("echo" as any)) {
  AudioFilters.define("echo", "aecho=0.8:0.88:60:0.4");
}

export default {
  data: new SlashCommandBuilder()
    .setName("echo")
    .setDescription("Toggle echo audio effect"),
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
      return interaction.editReply({ content: "❌ There is no music playing." }).catch(console.error);
    }

    const isEnabled = queue.filters.ffmpeg.isEnabled("echo" as any);
    await queue.filters.ffmpeg.toggle(["echo" as any]);

    const status = !isEnabled ? "enabled" : "disabled";
    await logAction(interaction.guild!, interaction.user, "setting_change", `Echo ${status}`);

    return interaction.editReply({
      content: `<@${interaction.user.id}> 🔊 Echo effect is now **${status}**`
    }).catch(console.error);
  }
};
