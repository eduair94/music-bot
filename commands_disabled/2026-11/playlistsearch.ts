import {
    ActionRowBuilder,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    EmbedBuilder
} from "discord.js";
import youtube from "youtube-sr";
import { bot } from "../index";
import { i18n } from "../utils/i18n";
import { Command } from "../interfaces/Command";

const playlistsearch: Command = {
    data: new SlashCommandBuilder()
        .setName("playlistsearch")
        .setDescription("Search for a playlist and queue all tracks")
        .addStringOption(opt => opt.setName("query").setDescription("Playlist name to search").setRequired(true)),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const query = interaction.options.getString("query", true);
        const member = interaction.guild?.members.cache.get(interaction.user.id);

        if (!member?.voice.channel) {
            return interaction.reply({ content: i18n.__("search.errorNotChannel"), ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const results = await youtube.search(query, { limit: 10, type: "playlist" });

            if (!results || results.length === 0) {
                return interaction.editReply({ content: "No playlists found for that query." });
            }

            const options = results.slice(0, 10).map((playlist) => ({
                label: (playlist.title || "Unknown Playlist").substring(0, 100),
                description: `${playlist.videoCount || "?"} tracks â€¢ ${playlist.channel?.name || "Unknown"}`.substring(0, 100),
                value: playlist.url || playlist.id || "unknown"
            }));

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("playlist-select")
                    .setPlaceholder("Select a playlist to play")
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(options)
            );

            const embed = new EmbedBuilder()
                .setTitle("í³‹ Playlist Search Results")
                .setDescription(`Found ${results.length} playlists for "${query}"`)
                .setColor(0x9b59b6);

            const followUp = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            const collector = followUp.createMessageComponentCollector({ time: 60000 });
            
            collector.on("collect", async (selectInteraction) => {
                if (!(selectInteraction instanceof StringSelectMenuInteraction)) return;
                if (selectInteraction.user.id !== interaction.user.id) {
                    await selectInteraction.reply({ content: "This menu is not for you.", ephemeral: true });
                    return;
                }

                await selectInteraction.update({ content: "â³ Loading playlist...", embeds: [], components: [] });

                const playCommand = bot.slashCommandsMap.get("play");
                if (!playCommand) {
                    await interaction.followUp({ content: "Play command not found.", ephemeral: true });
                    return;
                }

                const selectedUrl = selectInteraction.values[0];
                await playCommand.execute(interaction, selectedUrl);
            });

            collector.on("end", (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({ content: "Playlist selection timed out.", embeds: [], components: [] }).catch(() => {});
                }
            });
        } catch (error) {
            console.error("Playlist search error:", error);
            return interaction.editReply({ content: "An error occurred while searching for playlists." });
        }
    }
};

export default playlistsearch;
