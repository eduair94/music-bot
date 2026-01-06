import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { Command } from "../interfaces/Command";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";
import { sessionOwners } from "./ownership";

const claim: Command = {
    data: new SlashCommandBuilder()
        .setName("claim")
        .setDescription("Claim ownership of the current session") as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const queue = useQueue(interaction.guildId);
        if (!queue || !queue.isPlaying()) {
            await interaction.reply({ content: i18n.__("common.no_music"), ephemeral: true });
            return;
        }

        const currentOwner = sessionOwners.get(interaction.guildId);
        
        if (currentOwner) {
            const vc = queue.channel;
            if (vc && vc.members.has(currentOwner)) {
                const embed = new EmbedBuilder()
                    .setTitle("‚ùå Session Already Owned")
                    .setColor(0xe74c3c)
                    .setDescription(`This session is already owned by <@${currentOwner}>.\n\nThe current owner must leave the voice channel or transfer ownership to you.`);
                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }
        }

        sessionOwners.set(interaction.guildId, interaction.user.id);
        
        const embed = new EmbedBuilder()
            .setTitle("Ì±ë Ownership Claimed")
            .setColor(0x2ecc71)
            .setDescription(`${interaction.user} is now the session owner.`)
            .addFields(
                { name: "Permissions", value: "You can now control the session and manage permissions.", inline: false }
            );
        
        await interaction.reply({ embeds: [embed] });
    }
};

export default claim;
