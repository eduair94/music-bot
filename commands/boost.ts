import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../interfaces/Command";
import { PatreonService } from "../services/patreon";
import { PremiumGuildService } from "../services/premiumGuild";
import { i18n } from "../utils/i18n";

const boost: Command = {
    data: new SlashCommandBuilder()
        .setName("boost")
        .setDescription("Manage server boost")
        .addSubcommand(sub => sub.setName("activate").setDescription("Boost this server"))
        .addSubcommand(sub => sub.setName("deactivate").setDescription("Remove your boost"))
        .addSubcommand(sub => sub.setName("list").setDescription("View your boosts"))
        .addSubcommand(sub => sub.setName("info").setDescription("View server boost status")) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const sub = interaction.options.getSubcommand();
        const patreon = PatreonService.getInstance();
        const premiumGuild = PremiumGuildService.getInstance();
        const isPremium = await patreon.isPremiumUser(interaction.user.id);

        if (sub === "activate") {
            if (!isPremium) {
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("No Premium").setColor(0xe74c3c)
                    .setDescription("You need premium to boost. Get it on Patreon!")], ephemeral: true });
                return;
            }
            const current = await premiumGuild.getGuildSettings(interaction.guildId);
            if (current) {
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Already Boosted").setColor(0xf39c12)
                    .setDescription("This server is already boosted!")], ephemeral: true });
                return;
            }
            const result = await premiumGuild.linkServer(interaction.user.id, interaction.guildId, interaction.guild?.name);
            if (!result.success) {
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Error").setColor(0xe74c3c)
                    .setDescription(result.message)], ephemeral: true });
                return;
            }
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Server Boosted!").setColor(0x2ecc71)
                .setDescription("Server is now boosted with your premium!")] });
        } else if (sub === "deactivate") {
            const current = await premiumGuild.getGuildSettings(interaction.guildId);
            if (!current || current.discordId !== interaction.user.id) {
                await interaction.reply({ content: "You didn't boost this server.", ephemeral: true });
                return;
            }
            await premiumGuild.unlinkServer(interaction.user.id, interaction.guildId);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Boost Removed").setColor(0xf39c12)
                .setDescription("Your boost has been removed.")] });
        } else if (sub === "list") {
            const servers = await premiumGuild.getUserServers(interaction.user.id);
            const embed = new EmbedBuilder().setTitle("Your Boosts").setColor(0x3498db);
            if (servers.length === 0) {
                embed.setDescription("You haven't boosted any servers.");
            } else {
                embed.setDescription(servers.map((s, i) => `${i+1}. Guild: \`${s.guildId}\``).join("\n"));
            }
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (sub === "info") {
            const current = await premiumGuild.getGuildSettings(interaction.guildId);
            const isPremiumGuild = await premiumGuild.isPremiumGuild(interaction.guildId);
            const embed = new EmbedBuilder().setTitle("Server Boost Info").setColor(isPremiumGuild ? 0xf96854 : 0x95a5a6);
            if (current && isPremiumGuild) {
                embed.setDescription("This server is boosted!");
                embed.addFields(
                    { name: "Bitrate", value: `${current.audioBitrate}kbps`, inline: true },
                    { name: "By", value: `<@${current.discordId}>`, inline: true }
                );
            } else {
                embed.setDescription("Not boosted. Use `/boost activate`");
            }
            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default boost;
