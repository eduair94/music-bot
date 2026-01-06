import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const commandenableall: Command = {
    data: new SlashCommandBuilder()
        .setName("commandenableall")
        .setDescription("Enable all disabled commands")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        const disabledCount = settings.disabledCommands?.length || 0;

        await svc.updateSettings(interaction.guildId, { disabledCommands: [] });

        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle("✅ All Commands Enabled")
            .setColor(0x2ecc71)
            .setDescription(disabledCount > 0 
                ? `Re-enabled **${disabledCount}** commands.\n\nAll commands are now available.`
                : "No commands were disabled.")] });
    }
};

export default commandenableall;
