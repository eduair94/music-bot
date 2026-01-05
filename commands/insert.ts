import { ChatInputCommandInteraction, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { logAction } from "../utils/actionLog";
import { getPlaybackSettings } from "../utils/audioSettings";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("insert")
    .setDescription("Insert a track right after the currently playing song")
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription("Song name or URL to insert")
        .setRequired(true)
    ),
  cooldown: 1,
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const query = interaction.options.getString("song", true);
    const guildMember = interaction.member as GuildMember;
    const voiceChannel = guildMember?.voice?.channel;
    const guildId = interaction.guild!.id;

    if (!voiceChannel) {
      return interaction.editReply({ content: i18n.__("play.errorNotChannel") }).catch(console.error);
    }

    if (!canModifyQueue(guildMember)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(guildId);

    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: "❌ There is no music playing to insert after." }).catch(console.error);
    }

    try {
      const textChannel = interaction.channel as TextChannel;
      const { quality } = await getPlaybackSettings(interaction.user.id, guildId);
      
      const result = await playerService.play(voiceChannel, query, textChannel, quality.bitrate);

      if (!result || !result.track) {
        return interaction.editReply({ content: "❌ Could not find that track." }).catch(console.error);
      }

      // Move the newly added track to position 0 (right after current)
      const tracks = queue.tracks.toArray();
      const newTrackIndex = tracks.findIndex(t => t.url === result.track.url);
      
      if (newTrackIndex > 0) {
        // Remove from current position and insert at beginning
        const [track] = tracks.splice(newTrackIndex, 1);
        tracks.unshift(track);
        queue.tracks.clear();
        for (const t of tracks) {
          queue.tracks.add(t);
        }
      }

      await logAction(interaction.guild!, interaction.user, "insert", result.track.title);

      return interaction.editReply({
        content: `⏭️ Inserted **${result.track.title}** to play next`
      }).catch(console.error);
    } catch (error) {
      console.error("Insert error:", error);
      return interaction.editReply({ content: "❌ Failed to insert track." }).catch(console.error);
    }
  }
};
