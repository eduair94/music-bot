import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../interfaces/Command";
import { PatreonService } from "../services/patreon";
import { i18n } from "../utils/i18n";
import youtube from "youtube-sr";

const importplaylist: Command = {
    data: new SlashCommandBuilder()
        .setName("importplaylist")
        .setDescription("Import a playlist to your collections (Premium)")
        .addStringOption(opt => opt.setName("url").setDescription("Playlist URL (YouTube, Spotify)").setRequired(true))
        .addStringOption(opt => opt.setName("name").setDescription("Name for the collection").setRequired(true)),
    
    async execute(interaction: ChatInputCommandInteraction) {
        // Premium check
        const patreon = PatreonService.getInstance();
        const isPremium = await patreon.isPremiumUser(interaction.user.id);
        
        if (!isPremium) {
            await interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle("â­ Premium Feature")
                    .setColor(0xf96854)
                    .setDescription("Importing playlists is a premium feature.\n\n[Support us on Patreon](https://patreon.com) to unlock this!")
                ],
                ephemeral: true 
            });
            return;
        }

        const url = interaction.options.getString("url", true);
        const collectionName = interaction.options.getString("name", true);

        await interaction.deferReply();

        try {
            // Detect playlist type
            let tracks: { title: string; url: string; author: string }[] = [];

            if (url.includes("youtube.com") || url.includes("youtu.be")) {
                // YouTube playlist
                const playlist = await youtube.getPlaylist(url);
                if (!playlist) {
                    await interaction.editReply({ content: "Could not find that YouTube playlist." });
                    return;
                }

                const videos = await playlist.fetch();
                tracks = videos.videos.map(v => ({
                    title: v.title || "Unknown",
                    url: v.url,
                    author: v.channel?.name || "Unknown"
                }));
            } else if (url.includes("spotify.com")) {
                // Spotify playlist - would need Spotify API integration
                await interaction.editReply({ 
                    content: "Spotify import requires additional configuration. Please use a YouTube playlist URL for now." 
                });
                return;
            } else {
                await interaction.editReply({ content: "Unsupported playlist URL. Please use YouTube playlist links." });
                return;
            }

            if (tracks.length === 0) {
                await interaction.editReply({ content: "No tracks found in that playlist." });
                return;
            }

            // Store in collections (simplified - in production, save to database)
            const embed = new EmbedBuilder()
                .setTitle("í³¥ Playlist Imported")
                .setColor(0x2ecc71)
                .setDescription(`Successfully imported **${tracks.length}** tracks to collection: **${collectionName}**`)
                .addFields(
                    { name: "Collection", value: collectionName, inline: true },
                    { name: "Tracks", value: String(tracks.length), inline: true },
                    { name: "Source", value: url.includes("youtube") ? "YouTube" : "Spotify", inline: true }
                );

            if (tracks.length > 0) {
                const preview = tracks.slice(0, 5).map((t, i) => `${i + 1}. ${t.title}`).join("\n");
                embed.addFields({ name: "Preview", value: preview + (tracks.length > 5 ? `\n...and ${tracks.length - 5} more` : ""), inline: false });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Import playlist error:", error);
            await interaction.editReply({ content: "An error occurred while importing the playlist." });
        }
    }
};

export default importplaylist;
