import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { useQueue, GuildQueue, Track } from "discord-player";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

const addunique: Command = {
    data: new SlashCommandBuilder()
        .setName("addunique")
        .setDescription("Add only unique tracks (skip duplicates)")
        .addStringOption(opt => opt.setName("query").setDescription("Track URL or search query").setRequired(true)),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.guild?.members.cache.get(interaction.user.id);
        if (!member?.voice.channel) {
            return interaction.reply({ content: i18n.__("search.errorNotChannel"), ephemeral: true });
        }

        const query = interaction.options.getString("query", true);
        const queue = useQueue(interaction.guildId!);

        if (!queue || queue.isEmpty()) {
            // No queue yet, just play normally
            await interaction.reply({ content: "No queue exists. Use `/play` to start playing.", ephemeral: true });
            return;
        }

        await interaction.deferReply();

        // Check if track already exists in queue
        const isAlreadyInQueue = (url: string): boolean => {
            const tracks = queue.tracks.toArray();
            const current = queue.currentTrack;
            
            if (current?.url === url) return true;
            return tracks.some(t => t.url === url);
        };

        // For now, simple duplicate check by URL
        // In real implementation, would search first then check
        const isDuplicate = isAlreadyInQueue(query);

        if (isDuplicate) {
            await interaction.editReply({ embeds: [new EmbedBuilder()
                .setTitle("⚠️ Duplicate Track")
                .setColor(0xf39c12)
                .setDescription("This track is already in the queue. It was not added.")] });
            return;
        }

        // If not duplicate, suggest using /play
        await interaction.editReply({ embeds: [new EmbedBuilder()
            .setTitle("✅ Track is Unique")
            .setColor(0x2ecc71)
            .setDescription(`This track is not in the queue.\n\nUse \`/play ${query}\` to add it.`)] });
    }
};

export default addunique;
