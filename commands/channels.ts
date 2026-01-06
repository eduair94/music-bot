import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const channels: Command = {
    data: new SlashCommandBuilder()
        .setName("channels")
        .setDescription("Manage allowed channels")
        .addSubcommandGroup(grp => grp.setName("text").setDescription("Text channels")
            .addSubcommand(sub => sub.setName("enable").setDescription("Enable a text channel")
                .addChannelOption(opt => opt.setName("channel").setDescription("Channel").setRequired(true).addChannelTypes(ChannelType.GuildText)))
            .addSubcommand(sub => sub.setName("disable").setDescription("Disable a text channel")
                .addChannelOption(opt => opt.setName("channel").setDescription("Channel").setRequired(true).addChannelTypes(ChannelType.GuildText)))
            .addSubcommand(sub => sub.setName("enableall").setDescription("Enable all text channels"))
            .addSubcommand(sub => sub.setName("view").setDescription("View allowed text channels")))
        .addSubcommandGroup(grp => grp.setName("voice").setDescription("Voice channels")
            .addSubcommand(sub => sub.setName("enable").setDescription("Enable a voice channel")
                .addChannelOption(opt => opt.setName("channel").setDescription("Channel").setRequired(true).addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)))
            .addSubcommand(sub => sub.setName("disable").setDescription("Disable a voice channel")
                .addChannelOption(opt => opt.setName("channel").setDescription("Channel").setRequired(true).addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)))
            .addSubcommand(sub => sub.setName("enableall").setDescription("Enable all voice channels"))
            .addSubcommand(sub => sub.setName("view").setDescription("View allowed voice channels")))
        .addSubcommand(sub => sub.setName("log").setDescription("Set log channel")
            .addChannelOption(opt => opt.setName("channel").setDescription("Channel (empty to disable)").setRequired(false).addChannelTypes(ChannelType.GuildText)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();

        if (sub === "log") {
            const channel = interaction.options.getChannel("channel");
            await svc.updateSettings(interaction.guildId, { logChannelId: channel?.id || null });
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Log Channel").setColor(0x2ecc71)
                .setDescription(channel ? `Log channel set to ${channel}` : "Log channel disabled")] });
            return;
        }

        if (group === "text") {
            const allowed = [...(settings.allowedTextChannels || [])];
            if (sub === "enable") {
                const ch = interaction.options.getChannel("channel", true);
                if (allowed.length > 0 && !allowed.includes(ch.id)) {
                    allowed.push(ch.id);
                    await svc.updateSettings(interaction.guildId, { allowedTextChannels: allowed });
                }
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Text Channels").setColor(0x2ecc71).setDescription(`${ch} enabled`)] });
            } else if (sub === "disable") {
                const ch = interaction.options.getChannel("channel", true);
                const idx = allowed.indexOf(ch.id);
                if (idx > -1) {
                    allowed.splice(idx, 1);
                    await svc.updateSettings(interaction.guildId, { allowedTextChannels: allowed });
                }
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Text Channels").setColor(0xe74c3c).setDescription(`${ch} disabled`)] });
            } else if (sub === "enableall") {
                await svc.updateSettings(interaction.guildId, { allowedTextChannels: [] });
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Text Channels").setColor(0x2ecc71).setDescription("All text channels enabled")] });
            } else if (sub === "view") {
                const desc = allowed.length === 0 ? "All channels enabled" : `Allowed: ${allowed.map(id => `<#${id}>`).join(", ")}`;
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Text Channels").setColor(0x3498db).setDescription(desc)] });
            }
        } else if (group === "voice") {
            const allowed = [...(settings.allowedVoiceChannels || [])];
            if (sub === "enable") {
                const ch = interaction.options.getChannel("channel", true);
                if (allowed.length > 0 && !allowed.includes(ch.id)) {
                    allowed.push(ch.id);
                    await svc.updateSettings(interaction.guildId, { allowedVoiceChannels: allowed });
                }
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Voice Channels").setColor(0x2ecc71).setDescription(`${ch} enabled`)] });
            } else if (sub === "disable") {
                const ch = interaction.options.getChannel("channel", true);
                const idx = allowed.indexOf(ch.id);
                if (idx > -1) {
                    allowed.splice(idx, 1);
                    await svc.updateSettings(interaction.guildId, { allowedVoiceChannels: allowed });
                }
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Voice Channels").setColor(0xe74c3c).setDescription(`${ch} disabled`)] });
            } else if (sub === "enableall") {
                await svc.updateSettings(interaction.guildId, { allowedVoiceChannels: [] });
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Voice Channels").setColor(0x2ecc71).setDescription("All voice channels enabled")] });
            } else if (sub === "view") {
                const desc = allowed.length === 0 ? "All channels enabled" : `Allowed: ${allowed.map(id => `<#${id}>`).join(", ")}`;
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Voice Channels").setColor(0x3498db).setDescription(desc)] });
            }
        }
    }
};

export default channels;
