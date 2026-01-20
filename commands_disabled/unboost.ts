import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../interfaces/Command";
import { PremiumGuildService } from "../services/premiumGuild";
import { i18n } from "../utils/i18n";

const unboost: Command = {
    data: new SlashCommandBuilder()
        .setName("unboost")
        .setDescription("Remove your boost from a server")
        .addStringOption(opt => opt.setName("server").setDescription("Server ID to unboost (defaults to current)").setRequired(false))
        .addBooleanOption(opt => opt.setName("current").setDescription("Unboost the current server").setRequired(false)) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        const premiumGuild = PremiumGuildService.getInstance();
        
        const serverId = interaction.options.getString("server");
        const current = interaction.options.getBoolean("current") ?? true;
        
        const targetGuildId = serverId || (current && interaction.guildId ? interaction.guildId : null);
        
        if (!targetGuildId) {
            await interaction.reply({ 
                content: "Please specify a server ID or use this command in the server you want to unboost.", 
                ephemeral: true 
            });
            return;
        }

        const guildSettings = await premiumGuild.getGuildSettings(targetGuildId);
        
        if (!guildSettings) {
            const embed = new EmbedBuilder()
                .setTitle("‚ùå Not Boosted")
                .setColor(0xe74c3c)
                .setDescription("This server doesn't have an active boost.");
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        // Check if the user is the one who boosted
        if (guildSettings.discordId !== interaction.user.id) {
            const embed = new EmbedBuilder()
                .setTitle("‚ùå Not Your Boost")
                .setColor(0xe74c3c)
                .setDescription(`This server was boosted by <@${guildSettings.discordId}>. Only they can remove the boost.`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        await premiumGuild.unlinkServer(interaction.user.id, targetGuildId);
        
        const embed = new EmbedBuilder()
            .setTitle("Ì¥ì Boost Removed")
            .setColor(0xf39c12)
            .setDescription("Your boost has been removed from this server.")
            .addFields(
                { name: "Server", value: targetGuildId === interaction.guildId ? interaction.guild?.name || targetGuildId : targetGuildId, inline: true },
                { name: "Status", value: "No longer boosted", inline: true }
            )
            .setFooter({ text: "You can boost another server with /boost activate" });
        
        await interaction.reply({ embeds: [embed] });
    }
};

export default unboost;
