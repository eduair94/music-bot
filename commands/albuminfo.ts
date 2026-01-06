import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

const SPOTIFY_API_BASE = "https://trustpilot.digitalshopuy.com/spotify-data";

interface SpotifyAlbumSearchResult {
    id: string;
    name: string;
    artists: { name: string }[];
    images: { url: string }[];
    release_date: string;
}

interface SpotifyAlbumMetadata {
    name: string;
    artists: { name: string }[];
    images: { url: string }[];
    release_date: string;
    label: string;
    popularity: number;
    total_tracks: number;
    copyrights: { text: string; type: string }[];
    external_urls: { spotify: string };
}

interface SpotifyAlbumInfo {
    tracks: {
        items: {
            name: string;
            duration_ms: number;
            track_number: number;
            artists: { name: string }[];
        }[];
    };
}

const albuminfo: Command = {
    data: new SlashCommandBuilder()
        .setName("albuminfo")
        .setDescription("Get album information for the current track or search")
        .addStringOption(opt => opt.setName("query").setDescription("Album name to search").setRequired(false)),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const query = interaction.options.getString("query");
        const queue = useQueue(interaction.guildId!);
        
        let searchQuery = query;
        if (!searchQuery) {
            const currentTrack = queue?.currentTrack;
            if (!currentTrack) {
                await interaction.reply({ content: "No track playing. Please provide an album name to search.", ephemeral: true });
                return;
            }
            searchQuery = `${currentTrack.author} ${currentTrack.title}`;
        }

        await interaction.deferReply();

        try {
            // Search for albums using the Spotify API
            const searchResponse = await fetch(
                `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(searchQuery)}&type=albums`
            );

            if (!searchResponse.ok) {
                await interaction.editReply({ content: "Failed to search for albums." });
                return;
            }

            const searchData = await searchResponse.json();
            const albums: SpotifyAlbumSearchResult[] = searchData.albums?.items || searchData.items || searchData || [];

            if (!albums || albums.length === 0) {
                await interaction.editReply({ content: `No album found for "${searchQuery}".` });
                return;
            }

            // Get the first album result
            const album = albums[0];
            const albumId = album.id;

            // Fetch album metadata and album info in parallel
            const [metadataResponse, albumInfoResponse] = await Promise.all([
                fetch(`${SPOTIFY_API_BASE}/album_metadata?id=${albumId}`),
                fetch(`${SPOTIFY_API_BASE}/albums?id=${albumId}`)
            ]);

            let metadata: SpotifyAlbumMetadata | null = null;
            let albumInfo: SpotifyAlbumInfo | null = null;

            if (metadataResponse.ok) {
                metadata = await metadataResponse.json();
            }

            if (albumInfoResponse.ok) {
                albumInfo = await albumInfoResponse.json();
            }

            // Use metadata if available, otherwise fall back to search result
            const albumName = metadata?.name || album.name;
            const artistNames = (metadata?.artists || album.artists || []).map(a => a.name).join(", ");
            const albumImage = (metadata?.images || album.images || [])[0]?.url;
            const releaseDate = metadata?.release_date || album.release_date;
            const spotifyUrl = metadata?.external_urls?.spotify || `https://open.spotify.com/album/${albumId}`;

            const embed = new EmbedBuilder()
                .setTitle(`💿 ${albumName}`)
                .setColor(0x1DB954) // Spotify green
                .setDescription(`**Artist:** ${artistNames || "Unknown"}\n\n[Open in Spotify](${spotifyUrl})`)
                .setThumbnail(albumImage || null);

            // Add release date
            if (releaseDate) {
                embed.addFields({ name: "📅 Release Date", value: releaseDate, inline: true });
            }

            // Add total tracks
            if (metadata?.total_tracks) {
                embed.addFields({ name: "🎵 Total Tracks", value: metadata.total_tracks.toString(), inline: true });
            }

            // Add popularity
            if (metadata?.popularity !== undefined) {
                const popularityBar = "█".repeat(Math.floor(metadata.popularity / 10)) + "░".repeat(10 - Math.floor(metadata.popularity / 10));
                embed.addFields({ name: "📊 Popularity", value: `${popularityBar} ${metadata.popularity}%`, inline: true });
            }

            // Add label
            if (metadata?.label) {
                embed.addFields({ name: "🏷️ Label", value: metadata.label, inline: true });
            }

            // Add track list from album info
            if (albumInfo?.tracks?.items && albumInfo.tracks.items.length > 0) {
                const trackList = albumInfo.tracks.items
                    .slice(0, 10) // Limit to first 10 tracks
                    .map(track => {
                        const duration = formatDuration(track.duration_ms);
                        return `${track.track_number}. ${track.name} (${duration})`;
                    })
                    .join("\n");
                
                const trackListDisplay = albumInfo.tracks.items.length > 10 
                    ? `${trackList}\n... and ${albumInfo.tracks.items.length - 10} more tracks`
                    : trackList;
                
                embed.addFields({ name: "🎶 Tracks", value: trackListDisplay, inline: false });
            }

            // Add copyright info
            if (metadata?.copyrights && metadata.copyrights.length > 0) {
                const copyright = metadata.copyrights[0].text;
                embed.setFooter({ text: copyright });
            }

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Album info error:", error);
            await interaction.editReply({ content: "An error occurred while fetching album information." });
        }
    }
};

function formatDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default albuminfo;
