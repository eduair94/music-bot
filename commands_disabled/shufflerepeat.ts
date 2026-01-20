import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const shufflerepeat: Command = {
    data: new SlashCommandBuilder()
        .setName("shufflerepeat")
        .setDescription("Configure shuffle on repeat mode")
        .addSubcommand(sub => sub.setName("toggle").setDescription("Toggle shuffle on repeat")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable shuffle on repeat").setRequired(true)))
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
            await svc.updateSettings(interaction.guildId, { shuffleRepeat: enabled } as any);
            
            const embed = new EmbedBuilder()
                .setTitle(enabled ? "Ì¥Ä Shuffle on Repeat Enabled" : "Ì¥Ä Shuffle on Repeat Disabled")
                .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
                .setDescription(enabled 
                    ? "Queue will be automatically shuffled each time it repeats."
                    : "Queue order will be maintained when repeating.");

            await interaction.reply({ embeds: [embed] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("Ì¥Ä Shuffle on Repeat Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Status", value: extSettings.shuffleRepeat ? "‚úÖ Enabled" : "‚ùå Disabled", inline: true }
                )
                .setDescription("When enabled, the queue is shuffled automatically each time repeat queue loops.");

            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default shufflerepeat;
