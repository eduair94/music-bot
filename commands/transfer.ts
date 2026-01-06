import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { Command } from "../interfaces/Command";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";
import { sessionOwners } from "./ownership";

const transfer: Command = {
    data: new SlashCommandBuilder()
        .setName("transfer")
        .setDescription("Transfer session ownership to another member")
        .addUserOption(opt => opt.setName("user").setDescription("User to transfer ownership to").setRequired(true)) as SlashCommandBuilder,
    
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

        const member = interaction.member as GuildMember;
        const currentOwner = sessionOwners.get(interaction.guildId);
        
        // Check if user is the owner or has admin permissions
        if (currentOwner && currentOwner !== interaction.user.id && !member.permissions.has("Administrator")) {
            const embed = new EmbedBuilder()
                .setTitle("‚ùå Not Session Owner")
                .setColor(0xe74c3c)
                .setDescription(`Only the session owner (<@${currentOwner}>) or an administrator can transfer ownership.`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        const targetUser = interaction.options.getUser("user", true);
        
        // Check if target is in the voice channel
        const vc = queue.channel;
        if (vc && !vc.members.has(targetUser.id)) {
            const embed = new EmbedBuilder()
                .setTitle("‚ùå User Not in Voice Channel")
                .setColor(0xe74c3c)
                .setDescription(`${targetUser} must be in the voice channel to receive ownership.`);
            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        // Cannot transfer to yourself
        if (targetUser.id === interaction.user.id) {
            await interaction.reply({ content: "You already own the session!", ephemeral: true });
            return;
        }

        sessionOwners.set(interaction.guildId, targetUser.id);
        
        const embed = new EmbedBuilder()
            .setTitle("Ì±ë Ownership Transferred")
            .setColor(0x3498db)
            .setDescription(`Session ownership has been transferred from ${interaction.user} to ${targetUser}.`)
            .addFields(
                { name: "New Owner", value: `${targetUser}`, inline: true },
                { name: "Previous Owner", value: `${interaction.user}`, inline: true }
            );
        
        await interaction.reply({ embeds: [embed] });
    }
};

export default transfer;
