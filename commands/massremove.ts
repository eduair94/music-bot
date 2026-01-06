import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("massremove")
    .setDescription(i18n.__("massremove.description"))
    .addStringOption(option =>
      option
        .setName("indexes")
        .setDescription("Track indexes to remove (e.g., '1 3 5' or '1-5 8')")
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guild!.id);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: i18n.__("massremove.noQueue"),
        ephemeral: true
      });
    }

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("massremove.notInVoice"),
        ephemeral: true
      });
    }

    const indexesInput = interaction.options.getString("indexes", true);
    const tracks = queue.tracks.toArray();

    if (tracks.length === 0) {
      return interaction.reply({
        content: i18n.__("massremove.noTracks"),
        ephemeral: true
      });
    }

    // Parse indexes from input (supports "1 3 5" and "1-5 8" formats)
    const indexesToRemove: number[] = [];
    const parts = indexesInput.split(/\s+/);

    for (const part of parts) {
      if (part.includes("-")) {
        // Range format (e.g., "1-5")
        const [startStr, endStr] = part.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= tracks.length && !indexesToRemove.includes(i)) {
              indexesToRemove.push(i);
            }
          }
        }
      } else {
        // Single number
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= tracks.length && !indexesToRemove.includes(num)) {
          indexesToRemove.push(num);
        }
      }
    }

    if (indexesToRemove.length === 0) {
      return interaction.reply({
        content: i18n.__mf("massremove.invalidIndexes", { max: tracks.length }),
        ephemeral: true
      });
    }

    // Sort descending so we remove from the end first (to preserve indexes)
    indexesToRemove.sort((a, b) => b - a);

    const removedTracks: string[] = [];
    for (const index of indexesToRemove) {
      const removed = queue.removeTrack(index - 1); // Convert to 0-based index
      if (removed) {
        removedTracks.push(removed.title);
      }
    }

    return interaction.reply({
      content: i18n.__mf("massremove.success", { 
        count: removedTracks.length,
        tracks: removedTracks.slice(0, 5).join(", ") + (removedTracks.length > 5 ? ` and ${removedTracks.length - 5} more...` : "")
      })
    });
  }
};
