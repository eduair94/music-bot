import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const removeafterplayed: Command = {
    data: new SlashCommandBuilder()
        .setName("removeafterplayed")
        .setDescription("Configure automatic removal of played tracks")
        .addSubcommand(sub => sub.setName("toggle").setDescription("Toggle remove after played")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable removal after played").setRequired(true)))
        .addSubcommand(sub => sub.setName("view").setDescription("View current setting"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const sub = interaction.options.getSubcommand();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        const extSettings = settings as any;

        if (sub === "toggle") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { removeAfterPlayed: enabled } as any);
            
            const embed = new EmbedBuilder()
                .setTitle(enabled ? "Ì∑ëÔ∏è Remove After Played Enabled" : "Ì∑ëÔ∏è Remove After Played Disabled")
                .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
                .setDescription(enabled 
                    ? "Tracks will be removed from the queue after they've been played."
                    : "Tracks will remain in the queue after playing (for repeat modes).");

            await interaction.reply({ embeds: [embed] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("Ì∑ëÔ∏è Remove After Played Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Status", value: extSettings.removeAfterPlayed !== false ? "‚úÖ Enabled" : "‚ùå Disabled", inline: true }
                )
                .setDescription("When enabled, tracks are removed from queue after playing. Useful with repeat modes.");

            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default removeafterplayed;
