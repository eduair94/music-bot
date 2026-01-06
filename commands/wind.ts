import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Command } from "../interfaces/Command";
import { DiscordPlayerService } from "../services/discordPlayer";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

function parseTimeToMs(timeStr: string): number | null {
    const colonMatch = timeStr.match(/^(\d+):(\d+)$/);
    if (colonMatch) {
        const minutes = parseInt(colonMatch[1]);
        const seconds = parseInt(colonMatch[2]);
        return (minutes * 60 + seconds) * 1000;
    }
    
    const msMatch = timeStr.match(/^(\d+(?:\.\d+)?)\s*(ms|milliseconds?)$/i);
    if (msMatch) return parseFloat(msMatch[1]);
    
    const secMatch = timeStr.match(/^(\d+(?:\.\d+)?)\s*(s|sec|seconds?)?$/i);
    if (secMatch) return parseFloat(secMatch[1]) * 1000;
    
    const minSecMatch = timeStr.match(/^(\d+)m\s*(\d+)s$/i);
    if (minSecMatch) {
        return (parseInt(minSecMatch[1]) * 60 + parseInt(minSecMatch[2])) * 1000;
    }
    
    const minMatch = timeStr.match(/^(\d+(?:\.\d+)?)\s*(m|min|minutes?)$/i);
    if (minMatch) return parseFloat(minMatch[1]) * 60 * 1000;
    
    const plainNum = parseFloat(timeStr);
    if (!isNaN(plainNum)) return plainNum * 1000;
    
    return null;
}

function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const wind: Command = {
    data: new SlashCommandBuilder()
        .setName("wind")
        .setDescription("Wind to the desired position in the track")
        .addStringOption(opt => opt.setName("to").setDescription("Position to wind to (e.g., 1:30, 90s)").setRequired(false))
        .addStringOption(opt => opt.setName("time").setDescription("Time format (e.g., 2:45, 165)").setRequired(false)) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply().catch(console.error);
        
        const guildMember = interaction.guild?.members.cache.get(interaction.user.id);
        if (!guildMember || !canModifyQueue(guildMember)) {
            return interaction.editReply({ content: i18n.__("common.errorNotChannel") });
        }

        const hasDJ = await hasDJPermission(guildMember as GuildMember);
        if (!hasDJ) {
            return interaction.editReply({ content: "❌ You need the DJ role to use this command." });
        }

        const playerService = DiscordPlayerService.getInstance();
        const queue = playerService.getQueue(interaction.guild!.id);
        
        if (!queue || !queue.currentTrack) {
            return interaction.editReply({ content: i18n.__("common.no_music") });
        }

        const toPosition = interaction.options.getString("to");
        const timePosition = interaction.options.getString("time");
        const timeStr = toPosition || timePosition;
        
        if (!timeStr) {
            const currentMs = queue.node.streamTime;
            const durationMs = queue.currentTrack.durationMS;
            const embed = new EmbedBuilder()
                .setTitle("⏱️ Current Position")
                .setColor(0x3498db)
                .setDescription(`**${formatTime(currentMs)}** / **${formatTime(durationMs)}**`)
                .addFields(
                    { name: "Track", value: queue.currentTrack.title, inline: false }
                );
            return interaction.editReply({ embeds: [embed] });
        }

        const seekMs = parseTimeToMs(timeStr);
        
        if (seekMs === null) {
            return interaction.editReply({ content: "❌ Invalid time format. Use formats like `1:30`, `90`, `1m30s`" });
        }

        const duration = queue.currentTrack.durationMS;
        if (seekMs < 0 || seekMs >= duration) {
            return interaction.editReply({ 
                content: `❌ Time must be between 0:00 and ${formatTime(duration)}`
            });
        }

        await queue.node.seek(seekMs);
        
        const embed = new EmbedBuilder()
            .setTitle("⏩ Wound to Position")
            .setColor(0x2ecc71)
            .setDescription(`Jumped to **${formatTime(seekMs)}** in the current track`)
            .addFields(
                { name: "Track", value: queue.currentTrack.title, inline: true },
                { name: "Duration", value: formatTime(duration), inline: true }
            );
        
        return interaction.editReply({ embeds: [embed] });
    }
};

export default wind;
