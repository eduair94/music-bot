import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { Command } from "../interfaces/Command";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

const sessionOwners: Map<string, string> = new Map();

const ownership: Command = {
    data: new SlashCommandBuilder()
        .setName("ownership")
        .setDescription("Manage session ownership")
        .addSubcommand(sub => sub.setName("claim").setDescription("Claim ownership of the session"))
        .addSubcommand(sub => sub.setName("transfer").setDescription("Transfer ownership")
            .addUserOption(opt => opt.setName("user").setDescription("User to transfer to").setRequired(true)))
        .addSubcommand(sub => sub.setName("view").setDescription("View session owner")) as SlashCommandBuilder,
    
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

        const sub = interaction.options.getSubcommand();
        const member = interaction.member as GuildMember;

        if (sub === "claim") {
            const currentOwner = sessionOwners.get(interaction.guildId);
            if (currentOwner) {
                const vc = queue.channel;
                if (vc && vc.members.has(currentOwner)) {
                    await interaction.reply({ content: `Session owned by <@${currentOwner}>`, ephemeral: true });
                    return;
                }
            }
            sessionOwners.set(interaction.guildId, interaction.user.id);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Ownership Claimed").setColor(0x2ecc71)
                .setDescription(`${interaction.user} is now the session owner.`)] });
        } else if (sub === "transfer") {
            const currentOwner = sessionOwners.get(interaction.guildId);
            if (currentOwner && currentOwner !== interaction.user.id && !member.permissions.has("Administrator")) {
                await interaction.reply({ content: "You are not the session owner.", ephemeral: true });
                return;
            }
            const targetUser = interaction.options.getUser("user", true);
            const vc = queue.channel;
            if (vc && !vc.members.has(targetUser.id)) {
                await interaction.reply({ content: "User not in voice channel.", ephemeral: true });
                return;
            }
            sessionOwners.set(interaction.guildId, targetUser.id);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Ownership Transferred").setColor(0x3498db)
                .setDescription(`Ownership transferred from ${interaction.user} to ${targetUser}`)] });
        } else if (sub === "view") {
            const currentOwner = sessionOwners.get(interaction.guildId);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Session Owner").setColor(0x3498db)
                .setDescription(currentOwner ? `Owner: <@${currentOwner}>` : "No owner. Use /ownership claim")] });
        }
    }
};

export { sessionOwners };
export default ownership;
