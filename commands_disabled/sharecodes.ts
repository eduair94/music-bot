import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

// Share codes stored - in production would be in MongoDB
const shareCodeStore = new Map<string, { code: string; name: string; owner: string; createdAt: Date }[]>();

const sharecodes: Command = {
    data: new SlashCommandBuilder()
        .setName("sharecodes")
        .setDescription("List all your collection share codes"),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const userId = interaction.user.id;
        const codes = shareCodeStore.get(userId) || [];

        if (codes.length === 0) {
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("í´— Collection Share Codes")
                .setColor(0x3498db)
                .setDescription("You have no active share codes.\n\nUse `/collections share` to create a share code for your collections.")], ephemeral: true });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle("í´— Collection Share Codes")
            .setColor(0x3498db)
            .setDescription(`You have **${codes.length}** active share code(s).`)
            .addFields(
                codes.slice(0, 10).map(c => ({
                    name: c.name,
                    value: `Code: \`${c.code}\`\nCreated: <t:${Math.floor(c.createdAt.getTime() / 1000)}:R>`,
                    inline: true
                }))
            );

        if (codes.length > 10) {
            embed.setFooter({ text: `Showing 10 of ${codes.length} codes` });
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

export default sharecodes;
