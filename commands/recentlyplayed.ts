import { useHistory } from "discord-player";
import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

const recentlyplayed: Command = {
    data: new SlashCommandBuilder()
        .setName("recentlyplayed")
        .setDescription("View your recently played tracks")
        .addIntegerOption(opt => opt.setName("limit").setDescription("Number of tracks to show (default: 10)").setMinValue(1).setMaxValue(25).setRequired(false)) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const history = useHistory(interaction.guildId);
        const limit = interaction.options.getInteger("limit") || 10;
        
        if (!history || history.tracks.size === 0) {
            await interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle("🎵 Recently Played")
                    .setColor(0x95a5a6)
                    .setDescription("No tracks have been played recently in this server.")],
                ephemeral: true 
            });
            return;
        }

        const tracks = history.tracks.toArray().slice(0, limit);
        
        if (tracks.length === 0) {
            await interaction.reply({ 
                embeds: [new EmbedBuilder()
                    .setTitle("�� Recently Played")
                    .setColor(0x95a5a6)
                    .setDescription("No tracks in history.")],
                ephemeral: true 
            });
            return;
        }

        const trackList = tracks.map((track, i) => {
            const requester = track.requestedBy ? `<@${track.requestedBy.id}>` : "Unknown";
            return `**${i + 1}.** [${track.title}](${track.url})\n└ ${track.author} • ${track.duration} • ${requester}`;
        }).join("\n\n");

        const embed = new EmbedBuilder()
            .setTitle("🎵 Recently Played Tracks")
            .setColor(0x9b59b6)
            .setDescription(trackList.substring(0, 4000))
            .setFooter({ text: `Showing ${tracks.length} track(s) from history` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

export default recentlyplayed;
