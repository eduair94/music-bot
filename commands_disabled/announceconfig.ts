import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const announceconfig: Command = {
    data: new SlashCommandBuilder()
        .setName("announceconfig")
        .setDescription("Configure announcement settings")
        .addSubcommandGroup(group => group.setName("text").setDescription("Text channel announcements")
            .addSubcommand(sub => sub.setName("toggle").setDescription("Toggle text announcements")
                .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable announcements").setRequired(true)))
            .addSubcommand(sub => sub.setName("autodelete").setDescription("Toggle auto-delete announcements")
                .addBooleanOption(opt => opt.setName("enabled").setDescription("Auto-delete announcements").setRequired(true)))
            .addSubcommand(sub => sub.setName("extended").setDescription("Toggle extended announcements")
                .addBooleanOption(opt => opt.setName("enabled").setDescription("Show extended track info").setRequired(true))))
        .addSubcommandGroup(group => group.setName("stage").setDescription("Stage announcements")
            .addSubcommand(sub => sub.setName("toggle").setDescription("Toggle stage announcements")
                .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable stage announcements").setRequired(true)))
            .addSubcommand(sub => sub.setName("template").setDescription("Set stage announcement template")
                .addStringOption(opt => opt.setName("template").setDescription("Template ({title}, {author}, {duration})").setRequired(true))))
        .addSubcommandGroup(group => group.setName("voice").setDescription("Voice status announcements")
            .addSubcommand(sub => sub.setName("toggle").setDescription("Toggle voice status")
                .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable voice status").setRequired(true)))
            .addSubcommand(sub => sub.setName("template").setDescription("Set voice status template")
                .addStringOption(opt => opt.setName("template").setDescription("Template ({title}, {author})").setRequired(true)))
            .addSubcommand(sub => sub.setName("default").setDescription("Set default voice status")
                .addStringOption(opt => opt.setName("status").setDescription("Default status when not playing").setRequired(true).setMaxLength(500))))
        .addSubcommand(sub => sub.setName("view").setDescription("View all announce settings"))
        .addSubcommand(sub => sub.setName("reset").setDescription("Reset announce settings to defaults"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const group = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        const extSettings = settings as any;

        if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("📢 Announcement Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Text Announcements", value: [
                        `**Enabled:** ${extSettings.textAnnounce !== false ? "✅" : "❌"}`,
                        `**Auto-Delete:** ${extSettings.textAnnounceAutoDelete ? "✅" : "❌"}`,
                        `**Extended:** ${extSettings.textAnnounceExtended ? "✅" : "❌"}`
                    ].join("\n"), inline: true },
                    { name: "Stage Announcements", value: [
                        `**Enabled:** ${extSettings.stageAnnounce ? "✅" : "❌"}`,
                        `**Template:** ${extSettings.stageTemplate || "Default"}`
                    ].join("\n"), inline: true },
                    { name: "Voice Status", value: [
                        `**Enabled:** ${extSettings.voiceStatusAnnounce ? "✅" : "❌"}`,
                        `**Template:** ${extSettings.voiceStatusTemplate || "Default"}`,
                        `**Default:** ${extSettings.voiceStatusDefault || "None"}`
                    ].join("\n"), inline: true }
                );

            await interaction.reply({ embeds: [embed] });
        } else if (sub === "reset") {
            await svc.updateSettings(interaction.guildId, {
                textAnnounce: true,
                textAnnounceAutoDelete: false,
                textAnnounceExtended: false,
                stageAnnounce: false,
                stageTemplate: null,
                voiceStatusAnnounce: false,
                voiceStatusTemplate: null,
                voiceStatusDefault: null
            } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("🔄 Announcement Settings Reset")
                .setColor(0x2ecc71)
                .setDescription("All announcement settings reset to defaults.")] });
        } else if (group === "text") {
            if (sub === "toggle") {
                const enabled = interaction.options.getBoolean("enabled", true);
                await svc.updateSettings(interaction.guildId, { textAnnounce: enabled } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle(enabled ? "📢 Text Announcements Enabled" : "🔇 Text Announcements Disabled")
                    .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
                    .setDescription(enabled 
                        ? "Now playing messages will be sent to the text channel."
                        : "Now playing messages will not be sent.")] });
            } else if (sub === "autodelete") {
                const enabled = interaction.options.getBoolean("enabled", true);
                await svc.updateSettings(interaction.guildId, { textAnnounceAutoDelete: enabled } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle(enabled ? "🗑️ Auto-Delete Enabled" : "🗑️ Auto-Delete Disabled")
                    .setColor(0x2ecc71)
                    .setDescription(enabled 
                        ? "Now playing messages will be auto-deleted when track changes."
                        : "Now playing messages will remain in chat.")] });
            } else if (sub === "extended") {
                const enabled = interaction.options.getBoolean("enabled", true);
                await svc.updateSettings(interaction.guildId, { textAnnounceExtended: enabled } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle(enabled ? "📋 Extended Announcements Enabled" : "📋 Extended Announcements Disabled")
                    .setColor(0x2ecc71)
                    .setDescription(enabled 
                        ? "Announcements will include extended track information."
                        : "Announcements will show minimal track info.")] });
            }
        } else if (group === "stage") {
            if (sub === "toggle") {
                const enabled = interaction.options.getBoolean("enabled", true);
                await svc.updateSettings(interaction.guildId, { stageAnnounce: enabled } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle(enabled ? "🎭 Stage Announcements Enabled" : "🎭 Stage Announcements Disabled")
                    .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
                    .setDescription(enabled 
                        ? "Track info will be displayed in stage channel topics."
                        : "Stage channel topics will not be updated.")] });
            } else if (sub === "template") {
                const template = interaction.options.getString("template", true);
                await svc.updateSettings(interaction.guildId, { stageTemplate: template } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle("✏️ Stage Template Updated")
                    .setColor(0x2ecc71)
                    .setDescription(`Template set to: \`${template}\`\n\nVariables: {title}, {author}, {duration}, {requester}`)] });
            }
        } else if (group === "voice") {
            if (sub === "toggle") {
                const enabled = interaction.options.getBoolean("enabled", true);
                await svc.updateSettings(interaction.guildId, { voiceStatusAnnounce: enabled } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle(enabled ? "Voice Status Enabled" : "Voice Status Disabled")
                    .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
                    .setDescription(enabled 
                        ? "Voice channel status will show current track info."
                        : "Voice channel status will not be updated.")] });
            } else if (sub === "template") {
                const template = interaction.options.getString("template", true);
                await svc.updateSettings(interaction.guildId, { voiceStatusTemplate: template } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle("Voice Status Template Updated")
                    .setColor(0x2ecc71)
                    .setDescription(`Template set to: \`${template}\`\n\nVariables: {title}, {author}, {duration}`)] });
            } else if (sub === "default") {
                const status = interaction.options.getString("status", true);
                await svc.updateSettings(interaction.guildId, { voiceStatusDefault: status } as any);

                await interaction.reply({ embeds: [new EmbedBuilder()
                    .setTitle("Default Voice Status Set")
                    .setColor(0x2ecc71)
                    .setDescription(`Default status: \`${status}\`\n\nThis will be shown when nothing is playing.`)] });
            }
        }
    }
};

export default announceconfig;
