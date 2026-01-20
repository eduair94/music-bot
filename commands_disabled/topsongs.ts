import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

const topsongs: Command = {
    data: new SlashCommandBuilder()
        .setName("topsongs")
        .setDescription("Get top songs for an artist")
        .addStringOption(opt => opt.setName("artist").setDescription("Artist name to search").setRequired(false)),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const artistQuery = interaction.options.getString("artist");
        const queue = useQueue(interaction.guildId!);
        
        let searchArtist = artistQuery;
        if (!searchArtist) {
            const currentTrack = queue?.currentTrack;
            if (!currentTrack?.author) {
                await interaction.reply({ content: "No track playing. Please provide an artist name.", ephemeral: true });
                return;
            }
            searchArtist = currentTrack.author;
        }

        await interaction.deferReply();

        try {
            const geniusApiKey = process.env.GENIUS_API_KEY;
            if (!geniusApiKey) {
                await interaction.editReply({ content: "Genius API key not configured. Unable to fetch top songs." });
                return;
            }

            // Search for the artist
            const searchResponse = await fetch(
                `https://api.genius.com/search?q=${encodeURIComponent(searchArtist)}`,
                { headers: { Authorization: `Bearer ${geniusApiKey}` } }
            );

            if (!searchResponse.ok) {
                await interaction.editReply({ content: "Failed to fetch artist information." });
                return;
            }

            const searchData = await searchResponse.json();
            const hits = searchData.response?.hits || [];

            if (hits.length === 0) {
                await interaction.editReply({ content: `No songs found for "${searchArtist}".` });
                return;
            }

            // Group songs by the searched artist
            const artistSongs = hits
                .filter((hit: any) => 
                    hit.result?.primary_artist?.name?.toLowerCase().includes(searchArtist!.toLowerCase()) ||
                    searchArtist!.toLowerCase().includes(hit.result?.primary_artist?.name?.toLowerCase() || "")
                )
                .slice(0, 10);

            if (artistSongs.length === 0) {
                await interaction.editReply({ content: `No songs found for artist "${searchArtist}".` });
                return;
            }

            const artistName = artistSongs[0]?.result?.primary_artist?.name || searchArtist;
            const artistImage = artistSongs[0]?.result?.primary_artist?.image_url;

            const songList = artistSongs.map((hit: any, i: number) => {
                const song = hit.result;
                return `${i + 1}. **[${song.title}](${song.url})**`;
            }).join("\n");

            const embed = new EmbedBuilder()
                .setTitle(`í¾µ Top Songs by ${artistName}`)
                .setColor(0xf1c40f)
                .setDescription(songList);

            if (artistImage) {
                embed.setThumbnail(artistImage);
            }

            embed.setFooter({ text: "Data from Genius" });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Top songs error:", error);
            await interaction.editReply({ content: "An error occurred while fetching top songs." });
        }
    }
};

export default topsongs;
