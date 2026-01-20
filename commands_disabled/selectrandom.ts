import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const selectrandom: Command = {
    data: new SlashCommandBuilder()
        .setName("selectrandom")
        .setDescription("Configure random track selection mode")
        .addSubcommand(sub => sub.setName("toggle").setDescription("Toggle random selection")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable random selection").setRequired(true)))
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
            await svc.updateSettings(interaction.guildId, { selectRandom: enabled } as any);
            
            const embed = new EmbedBuilder()
                .setTitle(enabled ? "Ìæ≤ Random Selection Enabled" : "Ìæ≤ Random Selection Disabled")
                .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
                .setDescription(enabled 
                    ? "Tracks will be selected randomly from the queue."
                    : "Tracks will play in queue order.");

            await interaction.reply({ embeds: [embed] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("Ìæ≤ Random Selection Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Status", value: extSettings.selectRandom ? "‚úÖ Enabled" : "‚ùå Disabled", inline: true }
                )
                .setDescription("When enabled, tracks are selected randomly from the queue instead of playing in order.");

            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default selectrandom;
