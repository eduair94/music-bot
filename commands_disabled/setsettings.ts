import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const setsettings: Command = {
    data: new SlashCommandBuilder()
        .setName("setsettings")
        .setDescription("Configure bot settings")
        .addSubcommand(sub => sub.setName("maxtracklen").setDescription("Set max track length in seconds")
            .addIntegerOption(opt => opt.setName("seconds").setDescription("Max length (0=unlimited)").setRequired(true).setMinValue(0).setMaxValue(86400)))
        .addSubcommand(sub => sub.setName("maxqueue").setDescription("Set max queue size")
            .addIntegerOption(opt => opt.setName("size").setDescription("Max tracks in queue").setRequired(true).setMinValue(1).setMaxValue(10000)))
        .addSubcommand(sub => sub.setName("maxvolume").setDescription("Set max volume")
            .addIntegerOption(opt => opt.setName("volume").setDescription("Max volume %").setRequired(true).setMinValue(1).setMaxValue(200)))
        .addSubcommand(sub => sub.setName("defaultvolume").setDescription("Set default volume")
            .addIntegerOption(opt => opt.setName("volume").setDescription("Default volume %").setRequired(true).setMinValue(1).setMaxValue(100)))
        .addSubcommand(sub => sub.setName("voteskip").setDescription("Configure vote skip")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable vote skip").setRequired(true))
            .addIntegerOption(opt => opt.setName("percentage").setDescription("Percentage needed (10-100)").setRequired(false).setMinValue(10).setMaxValue(100)))
        .addSubcommand(sub => sub.setName("announce").setDescription("Configure announcements")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable announcements").setRequired(true)))
        .addSubcommand(sub => sub.setName("autoleave").setDescription("Configure auto-leave")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable auto-leave").setRequired(true))
            .addIntegerOption(opt => opt.setName("timeout").setDescription("Seconds before leaving").setRequired(false).setMinValue(30).setMaxValue(3600)))
        .addSubcommand(sub => sub.setName("duplicates").setDescription("Prevent duplicates")
            .addBooleanOption(opt => opt.setName("prevent").setDescription("Prevent duplicates").setRequired(true)))
        .addSubcommand(sub => sub.setName("language").setDescription("Set language")
            .addStringOption(opt => opt.setName("lang").setDescription("Language").setRequired(true)
                .addChoices({ name: "English", value: "en" },{ name: "Spanish", value: "es" },{ name: "Portuguese", value: "pt_br" },{ name: "French", value: "fr" },{ name: "German", value: "de" })))
        .addSubcommand(sub => sub.setName("reset").setDescription("Reset all settings"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }
        const sub = interaction.options.getSubcommand();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        
        if (sub === "maxtracklen") {
            const val = interaction.options.getInteger("seconds", true);
            await svc.updateSettings(interaction.guildId, { maxSongDuration: val });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Settings Updated").setColor(0x2ecc71)
                .setDescription(val === 0 ? "Max track length: unlimited" : `Max track length: ${val}s`)] });
        } else if (sub === "maxqueue") {
            const val = interaction.options.getInteger("size", true);
            await svc.updateSettings(interaction.guildId, { maxQueueSize: val });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Settings Updated").setColor(0x2ecc71)
                .setDescription(`Max queue size: ${val} tracks`)] });
        } else if (sub === "maxvolume") {
            const val = interaction.options.getInteger("volume", true);
            await svc.updateSettings(interaction.guildId, { maxVolume: val });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Settings Updated").setColor(0x2ecc71)
                .setDescription(`Max volume: ${val}%`)] });
        } else if (sub === "defaultvolume") {
            const val = interaction.options.getInteger("volume", true);
            await svc.updateSettings(interaction.guildId, { defaultVolume: val });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Settings Updated").setColor(0x2ecc71)
                .setDescription(`Default volume: ${val}%`)] });
        } else if (sub === "voteskip") {
            const enabled = interaction.options.getBoolean("enabled", true);
            const pct = interaction.options.getInteger("percentage") || settings.voteSkipPercentage;
            await svc.updateSettings(interaction.guildId, { voteSkipPercentage: enabled ? pct : 0 });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Settings Updated").setColor(0x2ecc71)
                .setDescription(enabled ? `Vote skip enabled at ${pct}%` : "Vote skip disabled")] });
        } else if (sub === "announce") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { announceNowPlaying: enabled });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Settings Updated").setColor(0x2ecc71)
                .setDescription(enabled ? "Announcements enabled" : "Announcements disabled")] });
        } else if (sub === "autoleave") {
            const enabled = interaction.options.getBoolean("enabled", true);
            const timeout = interaction.options.getInteger("timeout") || settings.autoLeaveTimeout;
            await svc.updateSettings(interaction.guildId, { autoLeaveEmpty: enabled, autoLeaveTimeout: timeout });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Settings Updated").setColor(0x2ecc71)
                .setDescription(enabled ? `Auto-leave enabled (${timeout}s timeout)` : "Auto-leave disabled")] });
        } else if (sub === "duplicates") {
            const prevent = interaction.options.getBoolean("prevent", true);
            await svc.updateSettings(interaction.guildId, { preventDuplicates: prevent });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Settings Updated").setColor(0x2ecc71)
                .setDescription(prevent ? "Duplicates prevented" : "Duplicates allowed")] });
        } else if (sub === "language") {
            const lang = interaction.options.getString("lang", true);
            await svc.updateSettings(interaction.guildId, { language: lang });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Settings Updated").setColor(0x2ecc71)
                .setDescription(`Language set to ${lang}`)] });
        } else if (sub === "reset") {
            await svc.updateSettings(interaction.guildId, {
                defaultVolume: 80, maxVolume: 100, maxQueueSize: 500, maxSongDuration: 0,
                announceNowPlaying: true, autoLeaveEmpty: true, autoLeaveTimeout: 300,
                preventDuplicates: false, voteSkipPercentage: 50, language: "en"
            });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Settings Reset").setColor(0xf39c12)
                .setDescription("All settings reset to default")] });
        }
    }
};

export default setsettings;
