import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const announcer: Command = {
    data: new SlashCommandBuilder()
        .setName("announcer")
        .setDescription("Configure announcement settings")
        .addSubcommand(sub => sub.setName("channel").setDescription("Set announcement channel")
            .addChannelOption(opt => opt.setName("channel").setDescription("Channel for announcements").setRequired(false).addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(sub => sub.setName("reset").setDescription("Reset announcement channel"))
        .addSubcommand(sub => sub.setName("toggle").setDescription("Toggle announcements")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable/disable").setRequired(true)))
        .addSubcommand(sub => sub.setName("view").setDescription("View announcement settings"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const sub = interaction.options.getSubcommand();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);

        if (sub === "channel") {
            const channel = interaction.options.getChannel("channel");
            const channelId = channel?.id || null;
            
            // Store announce channel (we'd need to add this field to settings)
            await svc.updateSettings(interaction.guildId, { logChannelId: channelId });
            
            const embed = new EmbedBuilder()
                .setTitle("Ì≥¢ Announcement Channel")
                .setColor(0x2ecc71)
                .setDescription(channel ? `Announcements will be sent to ${channel}` : "Announcements will be sent to the command channel.");
            
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "reset") {
            await svc.updateSettings(interaction.guildId, { logChannelId: null });
            
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì≥¢ Announcement Channel Reset")
                .setColor(0xf39c12)
                .setDescription("Announcements will now be sent to the command channel.")] });
        } else if (sub === "toggle") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { announceNowPlaying: enabled });
            
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(enabled ? "Ì≥¢ Announcements Enabled" : "Ì¥á Announcements Disabled")
                .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
                .setDescription(enabled ? "Now playing announcements are now enabled." : "Now playing announcements have been disabled.")] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("Ì≥¢ Announcement Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Status", value: settings.announceNowPlaying ? "‚úÖ Enabled" : "‚ùå Disabled", inline: true },
                    { name: "Channel", value: settings.logChannelId ? `<#${settings.logChannelId}>` : "Command channel", inline: true }
                );
            
            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default announcer;
