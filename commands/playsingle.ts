import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, TextChannel } from "discord.js";
import youtube from "youtube-sr";
import { Command } from "../interfaces/Command";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

const playsingle: Command = {
    data: new SlashCommandBuilder()
        .setName("playsingle")
        .setDescription("Queue a single track from a playlist by position")
        .addStringOption(opt => opt.setName("url").setDescription("Playlist URL").setRequired(true))
        .addIntegerOption(opt => opt.setName("position").setDescription("Track position (1-based)").setRequired(true).setMinValue(1)),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const url = interaction.options.getString("url", true);
        const position = interaction.options.getInteger("position", true);
        const member = interaction.guild?.members.cache.get(interaction.user.id);

        if (!member?.voice.channel) {
            return interaction.reply({ content: i18n.__("search.errorNotChannel"), ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const playlist = await youtube.getPlaylist(url);
            if (!playlist) {
                return interaction.editReply({ content: "Could not find that playlist." });
            }

            const videos = await playlist.fetch();
            if (!videos.videos || videos.videos.length === 0) {
                return interaction.editReply({ content: "No tracks found in playlist." });
            }

            if (position > videos.videos.length) {
                return interaction.editReply({ 
                    content: `Position ${position} is out of range. Playlist has ${videos.videos.length} tracks.` 
                });
            }

            const video = videos.videos[position - 1];
            
            // Use discord-player to play the track
            const discordPlayer = DiscordPlayerService.getInstance();
            await discordPlayer.play(member.voice.channel, video.url, interaction.channel as TextChannel);

            const embed = new EmbedBuilder()
                .setTitle("🎵 Track Added")
                .setDescription(`**[${video.title}](${video.url})**`)
                .setColor(0x2ecc71)
                .addFields(
                    { name: "From Playlist", value: playlist.title || "Unknown", inline: true },
                    { name: "Position", value: `#${position}`, inline: true }
                );

            if (video.thumbnail?.url) {
                embed.setThumbnail(video.thumbnail.url);
            }

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Playsingle error:", error);
            return interaction.editReply({ content: "An error occurred while loading the track." });
        }
    }
};

export default playsingle;
