import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { bot } from "../index";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const commanddisableall: Command = {
    data: new SlashCommandBuilder()
        .setName("commanddisableall")
        .setDescription("Disable all commands except essential ones")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const protectedCommands = ["commanddisable", "commanddisableall", "commandenable", "commandenableall", "help", "settings", "setup"];
        const allCommands = Array.from(bot.slashCommandsMap.keys());
        const toDisable = allCommands.filter(cmd => !protectedCommands.includes(cmd));

        const svc = GuildSettingsService.getInstance();
        await svc.updateSettings(interaction.guildId, { disabledCommands: toDisable });

        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle("��� All Commands Disabled")
            .setColor(0xe74c3c)
            .setDescription(`Disabled **${toDisable.length}** commands.\n\nProtected commands still available:\n${protectedCommands.map(c => `\`/${c}\``).join(", ")}\n\nUse \`/commandenableall\` to restore all commands.`)] });
    }
};

export default commanddisableall;
