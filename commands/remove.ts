import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

const pattern = /^[0-9]{1,2}(\s*,\s*[0-9]{1,2})*$/;

export default {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription(i18n.__("remove.description"))
    .addStringOption((option) =>
      option.setName("slot").setDescription(i18n.__("remove.description")).setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    // Defer reply immediately to prevent interaction timeout
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);
    const removeArgs = interaction.options.getString("slot");

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
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
      return interaction.editReply({ content: i18n.__("remove.errorNotQueue") }).catch(console.error);
    }

    if (!removeArgs) {
      return interaction.editReply({ content: i18n.__mf("remove.usageReply", { prefix: "/" }) }).catch(console.error);
    }

    const tracks = queue.tracks.toArray();
    const songs = removeArgs.split(",").map((arg) => parseInt(arg.trim()));

    if (pattern.test(removeArgs)) {
      const removed: string[] = [];
      // Remove tracks in reverse order to maintain indices
      songs.sort((a, b) => b - a).forEach((index) => {
        if (index >= 1 && index <= tracks.length) {
          const track = queue.tracks.at(index - 1);
          if (track) {
            removed.push(track.title);
            queue.removeTrack(index - 1);
          }
        }
      });

      if (removed.length > 0) {
        return interaction.editReply({
          content: i18n.__mf("remove.result", {
            title: removed.join("\n"),
            author: interaction.user.id
          })
        }).catch(console.error);
      }
    } else if (!isNaN(+removeArgs) && +removeArgs >= 1 && +removeArgs <= tracks.length) {
      const track = queue.tracks.at(+removeArgs - 1);
      queue.removeTrack(+removeArgs - 1);
      return interaction.editReply({
        content: i18n.__mf("remove.result", {
          title: track?.title || "Unknown",
          author: interaction.user.id
        })
      }).catch(console.error);
    }
    
    return interaction.editReply({ content: i18n.__mf("remove.usageReply", { prefix: "/" }) }).catch(console.error);
  }
};
