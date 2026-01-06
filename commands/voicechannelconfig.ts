import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const voicechannelconfig: Command = {
    data: new SlashCommandBuilder()
        .setName("voicechannelconfig")
        .setDescription("Configure voice channel settings")
        .addSubcommand(sub => sub.setName("message").setDescription("Set message for disabled voice channels")
            .addStringOption(opt => opt.setName("message").setDescription("Message to show (empty to disable)").setRequired(false).setMaxLength(500)))
        .addSubcommand(sub => sub.setName("view").setDescription("View voice channel settings"))
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

        if (sub === "message") {
            const message = interaction.options.getString("message") || "";
            await svc.updateSettings(interaction.guildId, { disabledVoiceChannelMessage: message || null } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("í´Š Voice Channel Message Updated")
                .setColor(0x2ecc71)
                .setDescription(message 
                    ? `Message for disabled voice channels: "${message}"`
                    : "No message will be shown for disabled voice channels.")] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("í´Š Voice Channel Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Disabled Message", value: extSettings.disabledVoiceChannelMessage || "Default (no custom message)", inline: false }
                )
                .setDescription("Configure how disabled voice channels behave.");

            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default voicechannelconfig;
