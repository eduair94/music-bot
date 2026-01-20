import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const timeout: Command = {
    data: new SlashCommandBuilder()
        .setName("timeout")
        .setDescription("Manage bot timeout settings")
        .addSubcommand(sub => sub.setName("set").setDescription("Set auto-leave timeout")
            .addIntegerOption(opt => opt.setName("seconds").setDescription("Seconds before leaving (30-3600)").setRequired(true).setMinValue(30).setMaxValue(3600)))
        .addSubcommand(sub => sub.setName("view").setDescription("View current timeout settings"))
        .addSubcommand(sub => sub.setName("disable").setDescription("Disable auto-leave timeout"))
        .addSubcommand(sub => sub.setName("enable").setDescription("Enable auto-leave timeout"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const sub = interaction.options.getSubcommand();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);

        if (sub === "set") {
            const seconds = interaction.options.getInteger("seconds", true);
            await svc.updateSettings(interaction.guildId, { autoLeaveTimeout: seconds, autoLeaveEmpty: true });
            
            const embed = new EmbedBuilder()
                .setTitle("⏱️ Timeout Updated")
                .setColor(0x2ecc71)
                .setDescription(`Bot will leave after **${seconds} seconds** of inactivity.\n\nAuto-leave has been enabled.`);
            
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("⏱️ Timeout Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Auto-Leave", value: settings.autoLeaveEmpty ? "✅ Enabled" : "❌ Disabled", inline: true },
                    { name: "Timeout", value: `${settings.autoLeaveTimeout} seconds`, inline: true },
                    { name: "Formatted", value: formatTimeout(settings.autoLeaveTimeout), inline: true }
                );
            
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "disable") {
            await svc.updateSettings(interaction.guildId, { autoLeaveEmpty: false });
            
            const embed = new EmbedBuilder()
                .setTitle("⏱️ Auto-Leave Disabled")
                .setColor(0xf39c12)
                .setDescription("The bot will stay in the voice channel indefinitely.");
            
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "enable") {
            await svc.updateSettings(interaction.guildId, { autoLeaveEmpty: true });
            
            const embed = new EmbedBuilder()
                .setTitle("⏱️ Auto-Leave Enabled")
                .setColor(0x2ecc71)
                .setDescription(`The bot will leave after **${settings.autoLeaveTimeout} seconds** of inactivity.`);
            
            await interaction.reply({ embeds: [embed] });
        }
    }
};

function formatTimeout(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
}

export default timeout;
