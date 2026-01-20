import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

const reorder: Command = {
    data: new SlashCommandBuilder()
        .setName("reorder")
        .setDescription("Reorder the queue by different options")
        .addStringOption(opt => opt.setName("by").setDescription("Order by").setRequired(true)
            .addChoices(
                { name: "Duration (shortest first)", value: "duration_asc" },
                { name: "Duration (longest first)", value: "duration_desc" },
                { name: "Title (A-Z)", value: "title_asc" },
                { name: "Title (Z-A)", value: "title_desc" },
                { name: "Author/Artist (A-Z)", value: "author_asc" },
                { name: "Author/Artist (Z-A)", value: "author_desc" },
                { name: "Added (oldest first)", value: "added_asc" },
                { name: "Added (newest first)", value: "added_desc" }
            )) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        const queue = useQueue(interaction.guildId!);
        
        if (!queue || queue.tracks.size === 0) {
            await interaction.reply({ content: i18n.__("common.errorNoQueue"), ephemeral: true });
            return;
        }

        const orderBy = interaction.options.getString("by", true);
        const tracks = queue.tracks.toArray();
        
        let sorted;
        switch (orderBy) {
            case "duration_asc":
                sorted = tracks.sort((a, b) => (a.durationMS || 0) - (b.durationMS || 0));
                break;
            case "duration_desc":
                sorted = tracks.sort((a, b) => (b.durationMS || 0) - (a.durationMS || 0));
                break;
            case "title_asc":
                sorted = tracks.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
                break;
            case "title_desc":
                sorted = tracks.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
                break;
            case "author_asc":
                sorted = tracks.sort((a, b) => (a.author || "").localeCompare(b.author || ""));
                break;
            case "author_desc":
                sorted = tracks.sort((a, b) => (b.author || "").localeCompare(a.author || ""));
                break;
            case "added_asc":
                sorted = tracks; // Already in order added
                break;
            case "added_desc":
                sorted = tracks.reverse();
                break;
            default:
                sorted = tracks;
        }

        // Clear and re-add tracks
        queue.tracks.clear();
        for (const track of sorted) {
            queue.tracks.add(track);
        }

        const orderNames: Record<string, string> = {
            "duration_asc": "Duration (shortest first)",
            "duration_desc": "Duration (longest first)",
            "title_asc": "Title (A-Z)",
            "title_desc": "Title (Z-A)",
            "author_asc": "Author (A-Z)",
            "author_desc": "Author (Z-A)",
            "added_asc": "Added (oldest first)",
            "added_desc": "Added (newest first)"
        };

        const embed = new EmbedBuilder()
            .setTitle("í´€ Queue Reordered")
            .setDescription(`Queue has been reordered by: **${orderNames[orderBy]}**\n\nTotal tracks: ${sorted.length}`)
            .setColor(0x3498db);
        
        await interaction.reply({ embeds: [embed] });
    }
};

export default reorder;
