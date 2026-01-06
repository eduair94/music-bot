import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const serverconfig: Command = {
    data: new SlashCommandBuilder()
        .setName("serverconfig")
        .setDescription("Configure server-wide settings")
        .addSubcommand(sub => sub.setName("multibotownership").setDescription("Toggle multi-bot ownership")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Allow multi-bot control").setRequired(true)))
        .addSubcommand(sub => sub.setName("preferredbots").setDescription("Set preferred bots for the server")
            .addStringOption(opt => opt.setName("bots").setDescription("Bot names (comma separated)").setRequired(true)))
        .addSubcommand(sub => sub.setName("dashboardaccess").setDescription("Configure dashboard statistics access")
            .addStringOption(opt => opt.setName("access").setDescription("Access level").setRequired(true)
                .addChoices(
                    { name: "All Members - Everyone can view", value: "all" },
                    { name: "Staff Only - Manage Server required", value: "staff" },
                    { name: "Admin Only - Administrator required", value: "admin" },
                    { name: "Disabled - No one can view", value: "disabled" }
                )))
        .addSubcommand(sub => sub.setName("pagereplacedelete").setDescription("Toggle deleting old paginated messages")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Delete old pages when new one is sent").setRequired(true)))
        .addSubcommand(sub => sub.setName("pagedelete").setDescription("Toggle auto-deleting paginated messages")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Auto-delete paginated messages").setRequired(true)))
        .addSubcommand(sub => sub.setName("view").setDescription("View server configuration"))
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

        if (sub === "multibotownership") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { multiBotOwnership: enabled } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(enabled ? "Ì¥ñ Multi-Bot Ownership Enabled" : "Ì¥ñ Multi-Bot Ownership Disabled")
                .setColor(0x2ecc71)
                .setDescription(enabled 
                    ? "Multiple bots can now share control of sessions."
                    : "Only one bot can control sessions at a time.")] });
        } else if (sub === "preferredbots") {
            const bots = interaction.options.getString("bots", true);
            const botList = bots.split(",").map(b => b.trim()).filter(b => b.length > 0);
            await svc.updateSettings(interaction.guildId, { preferredBots: botList } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì¥ñ Preferred Bots Set")
                .setColor(0x2ecc71)
                .setDescription(`Server preferred bots: ${botList.map(b => `**${b}**`).join(", ")}`)] });
        } else if (sub === "dashboardaccess") {
            const access = interaction.options.getString("access", true);
            await svc.updateSettings(interaction.guildId, { dashboardAccess: access } as any);

            const accessDescriptions: Record<string, string> = {
                all: "All server members can view dashboard statistics.",
                staff: "Only members with Manage Server can view statistics.",
                admin: "Only administrators can view dashboard statistics.",
                disabled: "Dashboard statistics are disabled for this server."
            };

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì≥ä Dashboard Access Set")
                .setColor(0x2ecc71)
                .setDescription(accessDescriptions[access])] });
        } else if (sub === "pagereplacedelete") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { pageReplaceDelete: enabled } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(enabled ? "Ì≥Ñ Page Replace Delete Enabled" : "Ì≥Ñ Page Replace Delete Disabled")
                .setColor(0x2ecc71)
                .setDescription(enabled 
                    ? "Old paginated messages will be deleted when navigating."
                    : "Old paginated messages will be kept.")] });
        } else if (sub === "pagedelete") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { pageAutoDelete: enabled } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(enabled ? "Ì≥Ñ Page Auto-Delete Enabled" : "Ì≥Ñ Page Auto-Delete Disabled")
                .setColor(0x2ecc71)
                .setDescription(enabled 
                    ? "Paginated messages will be auto-deleted after timeout."
                    : "Paginated messages will remain after timeout.")] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("‚öôÔ∏è Server Configuration")
                .setColor(0x3498db)
                .addFields(
                    { name: "Multi-Bot Ownership", value: extSettings.multiBotOwnership ? "‚úÖ Enabled" : "‚ùå Disabled", inline: true },
                    { name: "Dashboard Access", value: (extSettings.dashboardAccess || "all").charAt(0).toUpperCase() + (extSettings.dashboardAccess || "all").slice(1), inline: true },
                    { name: "Preferred Bots", value: extSettings.preferredBots?.length ? extSettings.preferredBots.join(", ") : "None set", inline: true },
                    { name: "Page Replace Delete", value: extSettings.pageReplaceDelete ? "‚úÖ" : "‚ùå", inline: true },
                    { name: "Page Auto-Delete", value: extSettings.pageAutoDelete ? "‚úÖ" : "‚ùå", inline: true }
                );

            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default serverconfig;
