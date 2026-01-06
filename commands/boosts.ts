import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../interfaces/Command";
import { PremiumGuildService } from "../services/premiumGuild";
import { i18n } from "../utils/i18n";

const boosts: Command = {
    data: new SlashCommandBuilder()
        .setName("boosts")
        .setDescription("View your or the server's boosts")
        .addBooleanOption(opt => opt.setName("server").setDescription("Show server boost status instead of your boosts").setRequired(false)) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        const premiumGuild = PremiumGuildService.getInstance();
        const showServer = interaction.options.getBoolean("server") ?? false;

        if (showServer) {
            if (!interaction.guildId) {
                await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
                return;
            }

            const guildSettings = await premiumGuild.getGuildSettings(interaction.guildId);
            const isPremium = await premiumGuild.isPremiumGuild(interaction.guildId);

            const embed = new EmbedBuilder()
                .setTitle("íº€ Server Boost Status")
                .setColor(isPremium ? 0xf96854 : 0x95a5a6);

            if (guildSettings && isPremium) {
                embed.setDescription("This server is currently boosted!");
                embed.addFields(
                    { name: "Status", value: "âœ… Boosted", inline: true },
                    { name: "Boosted By", value: `<@${guildSettings.discordId}>`, inline: true },
                    { name: "Audio Bitrate", value: `${guildSettings.audioBitrate}kbps`, inline: true }
                );
            } else {
                embed.setDescription("This server is not currently boosted.");
                embed.addFields(
                    { name: "Status", value: "âŒ Not Boosted", inline: true },
                    { name: "To Boost", value: "Use `/boost activate`", inline: true }
                );
            }

            await interaction.reply({ embeds: [embed] });
        } else {
            const servers = await premiumGuild.getUserServers(interaction.user.id);
            
            const embed = new EmbedBuilder()
                .setTitle("íº€ Your Boosts")
                .setColor(0xf96854);

            if (servers.length === 0) {
                embed.setDescription("You haven't boosted any servers yet.");
                embed.addFields(
                    { name: "How to Boost", value: "Use `/boost activate` in a server to boost it with your premium subscription.", inline: false }
                );
            } else {
                const serverList = await Promise.all(servers.map(async (s, i) => {
                    try {
                        const guild = interaction.client.guilds.cache.get(s.guildId);
                        const name = guild?.name || `Unknown Server`;
                        return `**${i + 1}.** ${name}\nâ”” ID: \`${s.guildId}\` â€¢ Bitrate: ${s.audioBitrate}kbps`;
                    } catch {
                        return `**${i + 1}.** Unknown Server\nâ”” ID: \`${s.guildId}\``;
                    }
                }));

                embed.setDescription(serverList.join("\n\n"));
                embed.setFooter({ text: `Total boosts: ${servers.length}` });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};

export default boosts;
