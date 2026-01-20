import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { useQueue, useHistory } from "discord-player";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

const sessionstats: Command = {
    data: new SlashCommandBuilder()
        .setName("sessionstats")
        .setDescription("View statistics for the current session"),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const queue = useQueue(interaction.guildId!);
        const history = useHistory(interaction.guildId!);
        
        if (!queue && (!history || history.tracks.size === 0)) {
            await interaction.reply({ content: "No active or previous session found.", ephemeral: true });
            return;
        }

        // Collect all tracks (current, queued, and played)
        const currentTrack = queue?.currentTrack;
        const queuedTracks = queue?.tracks.toArray() || [];
        const playedTracks = history?.tracks.toArray() || [];
        
        // Calculate stats
        const totalTracksPlayed = playedTracks.length + (currentTrack ? 1 : 0);
        const totalTracksQueued = queuedTracks.length;
        
        // Duration played
        const playedDuration = playedTracks.reduce((acc, t) => acc + (t.durationMS || 0), 0);
        const queuedDuration = queuedTracks.reduce((acc, t) => acc + (t.durationMS || 0), 0);
        
        // Most active users
        const userCounts: Record<string, number> = {};
        [...playedTracks, ...queuedTracks, ...(currentTrack ? [currentTrack] : [])].forEach(track => {
            if (track.requestedBy) {
                userCounts[track.requestedBy.id] = (userCounts[track.requestedBy.id] || 0) + 1;
            }
        });
        
        const topUsers = Object.entries(userCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, count]) => `<@${id}>: ${count} tracks`);

        // Most played sources
        const sourceCounts: Record<string, number> = {};
        [...playedTracks, ...queuedTracks, ...(currentTrack ? [currentTrack] : [])].forEach(track => {
            const source = track.source || "unknown";
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });
        
        const topSources = Object.entries(sourceCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([source, count]) => `${source}: ${count}`);

        const formatDuration = (ms: number): string => {
            const hours = Math.floor(ms / 3600000);
            const mins = Math.floor((ms % 3600000) / 60000);
            if (hours > 0) return `${hours}h ${mins}m`;
            return `${mins}m`;
        };

        const embed = new EmbedBuilder()
            .setTitle("í³ˆ Session Statistics")
            .setColor(0x9b59b6)
            .addFields(
                { name: "í¾µ Tracks Played", value: String(totalTracksPlayed), inline: true },
                { name: "í³‹ Tracks In Queue", value: String(totalTracksQueued), inline: true },
                { name: "â±ï¸ Played Duration", value: formatDuration(playedDuration), inline: true },
                { name: "â³ Queue Duration", value: formatDuration(queuedDuration), inline: true },
                { name: "í±¥ Unique Participants", value: String(Object.keys(userCounts).length), inline: true },
                { name: "í³Š Total Tracks", value: String(totalTracksPlayed + totalTracksQueued), inline: true }
            );

        if (topUsers.length > 0) {
            embed.addFields({ name: "í¿† Top Contributors", value: topUsers.join("\n"), inline: false });
        }

        if (topSources.length > 0) {
            embed.addFields({ name: "í¾§ Sources", value: topSources.join(" â€¢ "), inline: false });
        }

        await interaction.reply({ embeds: [embed] });
    }
};

export default sessionstats;
