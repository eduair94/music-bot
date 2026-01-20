import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const autodelete: Command = {
    data: new SlashCommandBuilder()
        .setName("autodelete")
        .setDescription("Configure auto-delete for bot messages")
        .addSubcommand(sub => sub.setName("toggle").setDescription("Toggle auto-delete")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable auto-delete").setRequired(true)))
        .addSubcommand(sub => sub.setName("delay").setDescription("Set delete delay")
            .addIntegerOption(opt => opt.setName("seconds").setDescription("Seconds before deleting (5-60)").setRequired(true).setMinValue(5).setMaxValue(60)))
        .addSubcommand(sub => sub.setName("view").setDescription("View auto-delete settings"))
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
            await svc.updateSettings(interaction.guildId, { autoDelete: enabled } as any);
            
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(enabled ? "Ì∑ëÔ∏è Auto-Delete Enabled" : "Ì∑ëÔ∏è Auto-Delete Disabled")
                .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
                .setDescription(enabled 
                    ? `Bot messages will be auto-deleted after ${extSettings.autoDeleteDelay || 10} seconds.`
                    : "Bot messages will no longer be auto-deleted.")] });
        } else if (sub === "delay") {
            const seconds = interaction.options.getInteger("seconds", true);
            await svc.updateSettings(interaction.guildId, { autoDeleteDelay: seconds, autoDelete: true } as any);
            
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì∑ëÔ∏è Auto-Delete Delay Updated")
                .setColor(0x2ecc71)
                .setDescription(`Bot messages will be deleted after **${seconds} seconds**.`)] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("Ì∑ëÔ∏è Auto-Delete Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Status", value: extSettings.autoDelete ? "‚úÖ Enabled" : "‚ùå Disabled", inline: true },
                    { name: "Delay", value: `${extSettings.autoDeleteDelay || 10} seconds`, inline: true }
                );
            
            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default autodelete;
