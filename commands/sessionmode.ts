import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

type SessionModeType = "default" | "dj" | "owner" | "free";
type PermissionModeType = "default" | "strict" | "lenient";
type PropertiesModeType = "individual" | "shared";

const sessionmode: Command = {
    data: new SlashCommandBuilder()
        .setName("sessionmode")
        .setDescription("Configure session and permission modes")
        .addSubcommand(sub => sub.setName("view").setDescription("View current session mode"))
        .addSubcommand(sub => sub.setName("set").setDescription("Set session mode")
            .addStringOption(opt => opt.setName("mode").setDescription("Session mode").setRequired(true)
                .addChoices(
                    { name: "Default - Standard permissions", value: "default" },
                    { name: "DJ - Only DJs can control", value: "dj" },
                    { name: "Owner - Only session owner controls", value: "owner" },
                    { name: "Free - Anyone can control", value: "free" }
                )))
        .addSubcommand(sub => sub.setName("permission").setDescription("Set permission mode")
            .addStringOption(opt => opt.setName("mode").setDescription("Permission mode").setRequired(true)
                .addChoices(
                    { name: "Default - Normal permissions", value: "default" },
                    { name: "Strict - Restricted access", value: "strict" },
                    { name: "Lenient - Relaxed access", value: "lenient" }
                )))
        .addSubcommand(sub => sub.setName("properties").setDescription("Set properties mode")
            .addStringOption(opt => opt.setName("mode").setDescription("Properties mode").setRequired(true)
                .addChoices(
                    { name: "Individual - Each user has their own settings", value: "individual" },
                    { name: "Shared - Settings apply to entire session", value: "shared" }
                )))
        .addSubcommand(sub => sub.setName("combine").setDescription("Set properties combine mode")
            .addStringOption(opt => opt.setName("mode").setDescription("Combine mode").setRequired(true)
                .addChoices(
                    { name: "Override - Latest setting wins", value: "override" },
                    { name: "Merge - Combine settings", value: "merge" }
                )))
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

        const modeIcons: Record<string, string> = {
            default: "‚öôÔ∏è",
            dj: "Ìæß",
            owner: "Ì±ë",
            free: "Ìºê",
            strict: "Ì¥í",
            lenient: "Ì¥ì",
            individual: "Ì±§",
            shared: "Ì±•",
            override: "Ì≥ù",
            merge: "Ì¥Ä"
        };

        if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("ÌæõÔ∏è Session Mode Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Session Mode", value: `${modeIcons[extSettings.sessionMode || "default"]} ${(extSettings.sessionMode || "default").charAt(0).toUpperCase() + (extSettings.sessionMode || "default").slice(1)}`, inline: true },
                    { name: "Permission Mode", value: `${modeIcons[extSettings.permissionMode || "default"]} ${(extSettings.permissionMode || "default").charAt(0).toUpperCase() + (extSettings.permissionMode || "default").slice(1)}`, inline: true },
                    { name: "Properties Mode", value: `${modeIcons[extSettings.propertiesMode || "shared"]} ${(extSettings.propertiesMode || "shared").charAt(0).toUpperCase() + (extSettings.propertiesMode || "shared").slice(1)}`, inline: true },
                    { name: "Combine Mode", value: `${modeIcons[extSettings.combineMode || "override"]} ${(extSettings.combineMode || "override").charAt(0).toUpperCase() + (extSettings.combineMode || "override").slice(1)}`, inline: true }
                )
                .setDescription("These settings control how sessions behave and who can control playback.");

            await interaction.reply({ embeds: [embed] });
        } else if (sub === "set") {
            const mode = interaction.options.getString("mode", true) as SessionModeType;
            await svc.updateSettings(interaction.guildId, { sessionMode: mode } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${modeIcons[mode]} Session Mode Updated`)
                .setColor(0x2ecc71)
                .setDescription(`Session mode set to **${mode.charAt(0).toUpperCase() + mode.slice(1)}**.`)] });
        } else if (sub === "permission") {
            const mode = interaction.options.getString("mode", true) as PermissionModeType;
            await svc.updateSettings(interaction.guildId, { permissionMode: mode } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${modeIcons[mode]} Permission Mode Updated`)
                .setColor(0x2ecc71)
                .setDescription(`Permission mode set to **${mode.charAt(0).toUpperCase() + mode.slice(1)}**.`)] });
        } else if (sub === "properties") {
            const mode = interaction.options.getString("mode", true) as PropertiesModeType;
            await svc.updateSettings(interaction.guildId, { propertiesMode: mode } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${modeIcons[mode]} Properties Mode Updated`)
                .setColor(0x2ecc71)
                .setDescription(`Properties mode set to **${mode.charAt(0).toUpperCase() + mode.slice(1)}**.`)] });
        } else if (sub === "combine") {
            const mode = interaction.options.getString("mode", true);
            await svc.updateSettings(interaction.guildId, { combineMode: mode } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${modeIcons[mode]} Combine Mode Updated`)
                .setColor(0x2ecc71)
                .setDescription(`Properties combine mode set to **${mode.charAt(0).toUpperCase() + mode.slice(1)}**.`)] });
        }
    }
};

export default sessionmode;
