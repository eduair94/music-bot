import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

const sessioninfo: Command = {
    data: new SlashCommandBuilder()
        .setName("sessioninfo")
        .setDescription("View current music session information"),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const queue = useQueue(interaction.guildId!);
        
        if (!queue) {
            await interaction.reply({ content: "No active session in this server.", ephemeral: true });
            return;
        }

        const currentTrack = queue.currentTrack;
        const tracks = queue.tracks.toArray();
        const totalDuration = tracks.reduce((acc, t) => acc + (t.durationMS || 0), 0) + (currentTrack?.durationMS || 0);
        
        // Get unique requesters
        const requesters = new Set<string>();
        if (currentTrack?.requestedBy) requesters.add(currentTrack.requestedBy.id);
        tracks.forEach(t => { if (t.requestedBy) requesters.add(t.requestedBy.id); });

        // Calculate session duration estimate
        const formatDuration = (ms: number): string => {
            const hours = Math.floor(ms / 3600000);
            const mins = Math.floor((ms % 3600000) / 60000);
            const secs = Math.floor((ms % 60000) / 1000);
            if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
            if (mins > 0) return `${mins}m ${secs}s`;
            return `${secs}s`;
        };

        const repeatModes = ["Off", "Track", "Queue", "Autoplay"];
        const repeatMode = repeatModes[queue.repeatMode] || "Off";

        const embed = new EmbedBuilder()
            .setTitle("Ì≥ä Session Information")
            .setColor(0x3498db)
            .addFields(
                { name: "Status", value: queue.isPlaying() ? "‚ñ∂Ô∏è Playing" : "‚è∏Ô∏è Paused", inline: true },
                { name: "Volume", value: `${queue.node.volume}%`, inline: true },
                { name: "Repeat Mode", value: repeatMode, inline: true },
                { name: "Current Track", value: currentTrack ? `[${currentTrack.title}](${currentTrack.url})` : "None", inline: false },
                { name: "Queue Size", value: `${tracks.length} tracks`, inline: true },
                { name: "Total Duration", value: formatDuration(totalDuration), inline: true },
                { name: "Participants", value: `${requesters.size} users`, inline: true },
                { name: "Voice Channel", value: queue.channel ? `<#${queue.channel.id}>` : "Unknown", inline: true }
            );

        if (queue.node.isBuffering()) {
            embed.addFields({ name: "State", value: "‚è≥ Buffering...", inline: true });
        }

        // Progress of current track if playing
        if (currentTrack && queue.isPlaying()) {
            const progress = queue.node.getTimestamp();
            if (progress) {
                embed.addFields({
                    name: "Progress",
                    value: `${progress.current.label} / ${progress.total.label}`,
                    inline: true
                });
            }
        }

        await interaction.reply({ embeds: [embed] });
    }
};

export default sessioninfo;
