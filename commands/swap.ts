import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("swap")
    .setDescription("Swap the position of two tracks in the queue")
    .addIntegerOption((option) =>
      option
        .setName("position1")
        .setDescription("First track position")
        .setRequired(true)
        .setMinValue(1)
    )
    .addIntegerOption((option) =>
      option
        .setName("position2")
        .setDescription("Second track position")
        .setRequired(true)
        .setMinValue(1)
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

    if (!queue || queue.tracks.size === 0) {
      return interaction.editReply({ content: "❌ There is no queue." }).catch(console.error);
    }

    const pos1 = interaction.options.getInteger("position1", true);
    const pos2 = interaction.options.getInteger("position2", true);

    if (pos1 === pos2) {
      return interaction.editReply({ content: "❌ Cannot swap a track with itself." }).catch(console.error);
    }

    const queueSize = queue.tracks.size;
    if (pos1 > queueSize || pos2 > queueSize) {
      return interaction.editReply({ 
        content: `❌ Invalid position. Queue only has ${queueSize} tracks.`
      }).catch(console.error);
    }

    // Get tracks (convert to 0-indexed)
    const index1 = pos1 - 1;
    const index2 = pos2 - 1;
    
    const tracks = queue.tracks.toArray();
    const track1 = tracks[index1];
    const track2 = tracks[index2];

    if (!track1 || !track2) {
      return interaction.editReply({ content: "❌ Could not find tracks at specified positions." }).catch(console.error);
    }

    // Swap manually by rebuilding the queue
    [tracks[index1], tracks[index2]] = [tracks[index2], tracks[index1]];
    
    queue.tracks.clear();
    for (const track of tracks) {
      queue.tracks.add(track);
    }

    await logAction(interaction.guild!, interaction.user, "swap", `${track1.title} ↔ ${track2.title}`);

    return interaction.editReply({
      content: `<@${interaction.user.id}> 🔀 swapped **${track1.title}** (${pos1}) with **${track2.title}** (${pos2})`
    }).catch(console.error);
  }
};
