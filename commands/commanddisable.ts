import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits, AutocompleteInteraction } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";
import { bot } from "../index";

const commanddisable: Command = {
    data: new SlashCommandBuilder()
        .setName("commanddisable")
        .setDescription("Disable commands in this server")
        .addStringOption(opt => opt.setName("command").setDescription("Command to disable").setRequired(true).setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async autocomplete(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const commands = Array.from(bot.slashCommandsMap.keys())
            .filter(cmd => !["commanddisable", "commandenable", "help", "settings"].includes(cmd))
            .filter(cmd => cmd.toLowerCase().includes(focused))
            .slice(0, 25);
        
        await interaction.respond(commands.map(cmd => ({ name: cmd, value: cmd })));
    },
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const commandName = interaction.options.getString("command", true).toLowerCase();
        
        // Prevent disabling essential commands
        const protectedCommands = ["commanddisable", "commandenable", "help", "settings", "setup"];
        if (protectedCommands.includes(commandName)) {
            await interaction.reply({ content: `Cannot disable essential command: \`${commandName}\``, ephemeral: true });
            return;
        }

        // Check if command exists
        if (!bot.slashCommandsMap.has(commandName)) {
            await interaction.reply({ content: `Command not found: \`${commandName}\``, ephemeral: true });
            return;
        }

        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        const disabled = settings.disabledCommands || [];
        
        if (disabled.includes(commandName)) {
            await interaction.reply({ content: `Command \`${commandName}\` is already disabled.`, ephemeral: true });
            return;
        }

        disabled.push(commandName);
        await svc.updateSettings(interaction.guildId, { disabledCommands: disabled });

        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle("íº« Command Disabled")
            .setColor(0xe74c3c)
            .setDescription(`Command \`/${commandName}\` has been disabled in this server.\n\nUse \`/commandenable\` to re-enable it.`)] });
    }
};

export default commanddisable;
