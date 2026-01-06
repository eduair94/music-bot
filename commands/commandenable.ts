import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits, AutocompleteInteraction } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const commandenable: Command = {
    data: new SlashCommandBuilder()
        .setName("commandenable")
        .setDescription("Enable a disabled command")
        .addStringOption(opt => opt.setName("command").setDescription("Command to enable").setRequired(true).setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async autocomplete(interaction: AutocompleteInteraction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId!);
        const disabled = settings.disabledCommands || [];
        
        const matching = disabled
            .filter(cmd => cmd.toLowerCase().includes(focused))
            .slice(0, 25);
        
        await interaction.respond(matching.map(cmd => ({ name: cmd, value: cmd })));
    },
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const commandName = interaction.options.getString("command", true).toLowerCase();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        const disabled = settings.disabledCommands || [];
        
        const index = disabled.indexOf(commandName);
        if (index === -1) {
            await interaction.reply({ content: `Command \`${commandName}\` is not disabled.`, ephemeral: true });
            return;
        }

        disabled.splice(index, 1);
        await svc.updateSettings(interaction.guildId, { disabledCommands: disabled });

        await interaction.reply({ embeds: [new EmbedBuilder()
            .setTitle("✅ Command Enabled")
            .setColor(0x2ecc71)
            .setDescription(`Command \`/${commandName}\` has been re-enabled in this server.`)] });
    }
};

export default commandenable;
