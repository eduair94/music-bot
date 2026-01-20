import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const limits: Command = {
    data: new SlashCommandBuilder()
        .setName("limits")
        .setDescription("Configure track and playlist limits")
        .addSubcommandGroup(group => group.setName("track").setDescription("Track length limits")
            .addSubcommand(sub => sub.setName("max").setDescription("Set maximum track length")
                .addIntegerOption(opt => opt.setName("minutes").setDescription("Max length in minutes (0=unlimited)").setRequired(true).setMinValue(0).setMaxValue(1440)))
            .addSubcommand(sub => sub.setName("min").setDescription("Set minimum track length")
                .addIntegerOption(opt => opt.setName("seconds").setDescription("Min length in seconds (0=none)").setRequired(true).setMinValue(0).setMaxValue(600))))
        .addSubcommandGroup(group => group.setName("playlist").setDescription("Playlist limits")
            .addSubcommand(sub => sub.setName("maxlength").setDescription("Set maximum playlist length")
                .addIntegerOption(opt => opt.setName("minutes").setDescription("Max total length in minutes (0=unlimited)").setRequired(true).setMinValue(0).setMaxValue(1440)))
            .addSubcommand(sub => sub.setName("maxtracks").setDescription("Set maximum playlist tracks")
                .addIntegerOption(opt => opt.setName("count").setDescription("Max tracks per playlist (0=unlimited)").setRequired(true).setMinValue(0).setMaxValue(500))))
        .addSubcommandGroup(group => group.setName("user").setDescription("User limits")
            .addSubcommand(sub => sub.setName("maxtracks").setDescription("Set max tracks per user")
                .addIntegerOption(opt => opt.setName("count").setDescription("Max tracks per user (0=unlimited)").setRequired(true).setMinValue(0).setMaxValue(100)))
            .addSubcommand(sub => sub.setName("maxlength").setDescription("Set max total length per user")
                .addIntegerOption(opt => opt.setName("minutes").setDescription("Max total length per user (0=unlimited)").setRequired(true).setMinValue(0).setMaxValue(600))))
        .addSubcommand(sub => sub.setName("view").setDescription("View all limit settings"))
        .addSubcommand(sub => sub.setName("reset").setDescription("Reset all limits to defaults"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        const extSettings = settings as any;

        if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("í³ Limit Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Track Limits", value: [
                        `**Max Length:** ${extSettings.maxTrackLength ? `${extSettings.maxTrackLength} min` : "Unlimited"}`,
                        `**Min Length:** ${extSettings.minTrackLength ? `${extSettings.minTrackLength} sec` : "None"}`
                    ].join("\n"), inline: true },
                    { name: "Playlist Limits", value: [
                        `**Max Length:** ${extSettings.maxPlaylistLength ? `${extSettings.maxPlaylistLength} min` : "Unlimited"}`,
                        `**Max Tracks:** ${extSettings.maxPlaylistTracks || "Unlimited"}`
                    ].join("\n"), inline: true },
                    { name: "User Limits", value: [
                        `**Max Tracks:** ${extSettings.maxUserTracks || "Unlimited"}`,
                        `**Max Length:** ${extSettings.maxUserLength ? `${extSettings.maxUserLength} min` : "Unlimited"}`
                    ].join("\n"), inline: true }
                );

            await interaction.reply({ embeds: [embed] });
        } else if (sub === "reset") {
            await svc.updateSettings(interaction.guildId, {
                maxTrackLength: null,
                minTrackLength: null,
                maxPlaylistLength: null,
                maxPlaylistTracks: null,
                maxUserTracks: null,
                maxUserLength: null
            } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("í³ Limits Reset")
                .setColor(0x2ecc71)
                .setDescription("All limit settings have been reset to defaults (unlimited).")] });
        } else if (group === "track") {
            if (sub === "max") {
                const minutes = interaction.options.getInteger("minutes", true);
                await svc.updateSettings(interaction.guildId, { maxTrackLength: minutes || null } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle("í³ Max Track Length Updated")
                    .setColor(0x2ecc71)
                    .setDescription(minutes > 0 
                        ? `Tracks longer than **${minutes} minutes** will be rejected.`
                        : "Track length limit removed (unlimited).")] });
            } else if (sub === "min") {
                const seconds = interaction.options.getInteger("seconds", true);
                await svc.updateSettings(interaction.guildId, { minTrackLength: seconds || null } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle("í³ Min Track Length Updated")
                    .setColor(0x2ecc71)
                    .setDescription(seconds > 0 
                        ? `Tracks shorter than **${seconds} seconds** will be rejected.`
                        : "Minimum track length removed.")] });
            }
        } else if (group === "playlist") {
            if (sub === "maxlength") {
                const minutes = interaction.options.getInteger("minutes", true);
                await svc.updateSettings(interaction.guildId, { maxPlaylistLength: minutes || null } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle("í³ Max Playlist Length Updated")
                    .setColor(0x2ecc71)
                    .setDescription(minutes > 0 
                        ? `Playlists with total length over **${minutes} minutes** will be truncated.`
                        : "Playlist length limit removed (unlimited).")] });
            } else if (sub === "maxtracks") {
                const count = interaction.options.getInteger("count", true);
                await svc.updateSettings(interaction.guildId, { maxPlaylistTracks: count || null } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle("í³ Max Playlist Tracks Updated")
                    .setColor(0x2ecc71)
                    .setDescription(count > 0 
                        ? `Playlists will be limited to **${count} tracks**.`
                        : "Playlist track limit removed (unlimited).")] });
            }
        } else if (group === "user") {
            if (sub === "maxtracks") {
                const count = interaction.options.getInteger("count", true);
                await svc.updateSettings(interaction.guildId, { maxUserTracks: count || null } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle("í³ Max User Tracks Updated")
                    .setColor(0x2ecc71)
                    .setDescription(count > 0 
                        ? `Users can have at most **${count} tracks** in queue.`
                        : "User track limit removed (unlimited).")] });
            } else if (sub === "maxlength") {
                const minutes = interaction.options.getInteger("minutes", true);
                await svc.updateSettings(interaction.guildId, { maxUserLength: minutes || null } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle("í³ Max User Length Updated")
                    .setColor(0x2ecc71)
                    .setDescription(minutes > 0 
                        ? `Users can queue at most **${minutes} minutes** of tracks.`
                        : "User length limit removed (unlimited).")] });
            }
        }
    }
};

export default limits;
