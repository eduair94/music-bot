import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { useQueue, Track } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("removeuser")
    .setDescription(i18n.__("removeuser.description"))
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("The user whose tracks to remove")
        .setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guild!.id);

    if (!queue || !queue.isPlaying()) {
      return interaction.reply({
        content: i18n.__("removeuser.noQueue"),
        ephemeral: true
      });
    }

    const member = interaction.member as GuildMember;
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("removeuser.notInVoice"),
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser("user", true);
    const tracks = queue.tracks.toArray();

    if (tracks.length === 0) {
      return interaction.reply({
        content: i18n.__("removeuser.noTracks"),
        ephemeral: true
      });
    }

    // Find tracks requested by the target user
    const userTracks = tracks.filter((track: Track) => 
      track.requestedBy?.id === targetUser.id
    );

    if (userTracks.length === 0) {
      return interaction.reply({
        content: i18n.__mf("removeuser.noUserTracks", { user: targetUser.username }),
        ephemeral: true
      });
    }

    // Get indexes in descending order to preserve queue positions
    const indexesToRemove: number[] = [];
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].requestedBy?.id === targetUser.id) {
        indexesToRemove.push(i);
      }
    }
    indexesToRemove.sort((a, b) => b - a);

    // Remove tracks
    let removedCount = 0;
    for (const index of indexesToRemove) {
      const removed = queue.removeTrack(index);
      if (removed) {
        removedCount++;
      }
    }

    return interaction.reply({
      content: i18n.__mf("removeuser.success", { 
        count: removedCount,
        user: targetUser.username
      })
    });
  }
};
