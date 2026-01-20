import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const textchannelconfig: Command = {
    data: new SlashCommandBuilder()
        .setName("textchannelconfig")
        .setDescription("Configure text channel settings")
        .addSubcommand(sub => sub.setName("deleteoriginal").setDescription("Toggle deleting original command messages")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Delete original messages").setRequired(true)))
        .addSubcommand(sub => sub.setName("message").setDescription("Set message for disabled channels")
            .addStringOption(opt => opt.setName("message").setDescription("Message to show (empty to disable)").setRequired(false).setMaxLength(500)))
        .addSubcommand(sub => sub.setName("notifytype").setDescription("Set notify type for disabled channels")
            .addStringOption(opt => opt.setName("type").setDescription("Notification type").setRequired(true)
                .addChoices(
                    { name: "Reply - Reply to user", value: "reply" },
                    { name: "React - React to message", value: "react" },
                    { name: "DM - Send DM to user", value: "dm" },
                    { name: "None - No notification", value: "none" }
                )))
        .addSubcommand(sub => sub.setName("threadpolicy").setDescription("Set thread usage policy")
            .addStringOption(opt => opt.setName("policy").setDescription("Thread policy").setRequired(true)
                .addChoices(
                    { name: "Allow - Commands work in threads", value: "allow" },
                    { name: "Parent Only - Only parent channel settings", value: "parent" },
                    { name: "Deny - Disable commands in threads", value: "deny" }
                )))
        .addSubcommand(sub => sub.setName("view").setDescription("View text channel settings"))
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

        if (sub === "deleteoriginal") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { deleteOriginalMessages: enabled } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(enabled ? "Ì∑ëÔ∏è Delete Original Enabled" : "Ì∑ëÔ∏è Delete Original Disabled")
                .setColor(0x2ecc71)
                .setDescription(enabled 
                    ? "Command messages will be deleted after execution."
                    : "Command messages will remain in chat.")] });
        } else if (sub === "message") {
            const message = interaction.options.getString("message") || "";
            await svc.updateSettings(interaction.guildId, { disabledChannelMessage: message || null } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì≤¨ Disabled Channel Message Updated")
                .setColor(0x2ecc71)
                .setDescription(message 
                    ? `Message: "${message}"`
                    : "No message will be shown for disabled channels.")] });
        } else if (sub === "notifytype") {
            const type = interaction.options.getString("type", true);
            await svc.updateSettings(interaction.guildId, { disabledChannelNotifyType: type } as any);

            const typeDescriptions: Record<string, string> = {
                reply: "Users will receive a reply when using commands in disabled channels.",
                react: "Messages will receive a reaction when commands are used in disabled channels.",
                dm: "Users will receive a DM when using commands in disabled channels.",
                none: "No notification will be sent for commands in disabled channels."
            };

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì¥î Notify Type Updated")
                .setColor(0x2ecc71)
                .setDescription(typeDescriptions[type])] });
        } else if (sub === "threadpolicy") {
            const policy = interaction.options.getString("policy", true);
            await svc.updateSettings(interaction.guildId, { threadPolicy: policy } as any);

            const policyDescriptions: Record<string, string> = {
                allow: "Commands can be used in threads.",
                parent: "Threads use their parent channel's settings.",
                deny: "Commands cannot be used in threads."
            };

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì∑µ Thread Policy Updated")
                .setColor(0x2ecc71)
                .setDescription(policyDescriptions[policy])] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("Ì≥ù Text Channel Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Delete Original", value: extSettings.deleteOriginalMessages ? "‚úÖ Enabled" : "‚ùå Disabled", inline: true },
                    { name: "Notify Type", value: (extSettings.disabledChannelNotifyType || "reply").charAt(0).toUpperCase() + (extSettings.disabledChannelNotifyType || "reply").slice(1), inline: true },
                    { name: "Thread Policy", value: (extSettings.threadPolicy || "allow").charAt(0).toUpperCase() + (extSettings.threadPolicy || "allow").slice(1), inline: true },
                    { name: "Disabled Message", value: extSettings.disabledChannelMessage || "Default", inline: false }
                );

            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default textchannelconfig;
