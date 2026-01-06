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

const playselect: Command = {
    data: new SlashCommandBuilder()
        .setName("playselect")
        .setDescription("Select specific tracks from a playlist to queue")
        .addStringOption(opt => opt.setName("url").setDescription("Playlist URL").setRequired(true)),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const url = interaction.options.getString("url", true);
        const member = interaction.guild?.members.cache.get(interaction.user.id);

        if (!member?.voice.channel) {
            return interaction.reply({ content: i18n.__("search.errorNotChannel"), ephemeral: true });
        }

        await interaction.deferReply();

        try {
            const playlist = await youtube.getPlaylist(url);
            if (!playlist) {
                return interaction.editReply({ content: "Could not find that playlist." });
            }

            const videos = await playlist.fetch();
            if (!videos.videos || videos.videos.length === 0) {
                return interaction.editReply({ content: "No tracks found in playlist." });
            }

            const options = videos.videos.slice(0, 25).map((video, i) => ({
                label: `${i + 1}. ${(video.title || "Unknown").substring(0, 90)}`,
                description: video.channel?.name?.substring(0, 100) || "Unknown",
                value: video.url
            }));

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId("playselect-menu")
                    .setPlaceholder("Select tracks to queue")
                    .setMinValues(1)
                    .setMaxValues(Math.min(options.length, 10))
                    .addOptions(options)
            );

            const embed = new EmbedBuilder()
                .setTitle(`í³‹ ${playlist.title}`)
                .setDescription(`Select tracks to add to queue (max 10)\n\nShowing ${options.length} of ${videos.videos.length} tracks`)
                .setColor(0x3498db);

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            const collector = response.createMessageComponentCollector({ time: 60000 });
            
            collector.on("collect", async (selectInteraction) => {
                if (!(selectInteraction instanceof StringSelectMenuInteraction)) return;
                if (selectInteraction.user.id !== interaction.user.id) {
                    await selectInteraction.reply({ content: "This menu is not for you.", ephemeral: true });
                    return;
                }

                await selectInteraction.update({ content: `â³ Adding ${selectInteraction.values.length} tracks...`, embeds: [], components: [] });

                const playCommand = bot.slashCommandsMap.get("play");
                if (!playCommand) {
                    await interaction.followUp({ content: "Play command not found.", ephemeral: true });
                    return;
                }

                let addedCount = 0;
                for (const trackUrl of selectInteraction.values) {
                    try {
                        await playCommand.execute(interaction, trackUrl);
                        addedCount++;
                    } catch (e) {
                        console.error("Failed to add track:", e);
                    }
                }

                await interaction.editReply({ content: `âœ… Added ${addedCount} tracks to queue!` });
            });

            collector.on("end", (collected) => {
                if (collected.size === 0) {
                    interaction.editReply({ content: "Selection timed out.", embeds: [], components: [] }).catch(() => {});
                }
            });
        } catch (error) {
            console.error("Playselect error:", error);
            return interaction.editReply({ content: "An error occurred while loading the playlist." });
        }
    }
};

export default playselect;
