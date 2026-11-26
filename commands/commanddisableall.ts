import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { commands as registeredCommands } from "../structs/commandRegistry";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const commanddisableall: Command = {
    data: new SlashCommandBuilder()
        .setName("commanddisableall")
        .setDescription(i18n.__("commanddisableall.description"))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const protectedCommands = ["commanddisable", "commanddisableall", "commandenable", "commandenableall", "help", "settings", "setup"];
        const allCommands = Array.from(registeredCommands.keys());
        const toDisable = allCommands.filter(cmd => !protectedCommands.includes(cmd));

        const svc = GuildSettingsService.getInstance();
        await svc.updateSettings(interaction.guildId, { disabledCommands: toDisable });

        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle(`🚫 ${i18n.__("commanddisableall.title")}`)
            .setColor(0xe74c3c)
            .setDescription(i18n.__mf("commanddisableall.done", { count: toDisable.length, commands: protectedCommands.map(c => `\`/${c}\``).join(", ") }))] });
    }
};

export default commanddisableall;
