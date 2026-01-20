import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const voiceannounce: Command = {
    data: new SlashCommandBuilder()
        .setName("voiceannounce")
        .setDescription("Configure voice announcements (TTS)")
        .addSubcommand(sub => sub.setName("toggle").setDescription("Toggle voice announcements")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable voice announcements").setRequired(true)))
        .addSubcommand(sub => sub.setName("volume").setDescription("Set voice announcement volume")
            .addIntegerOption(opt => opt.setName("level").setDescription("Volume level (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)))
        .addSubcommand(sub => sub.setName("language").setDescription("Set announcement language")
            .addStringOption(opt => opt.setName("lang").setDescription("Language code").setRequired(true)
                .addChoices(
                    { name: "English", value: "en" },
                    { name: "Spanish", value: "es" },
                    { name: "French", value: "fr" },
                    { name: "German", value: "de" },
                    { name: "Japanese", value: "ja" },
                    { name: "Korean", value: "ko" },
                    { name: "Portuguese", value: "pt" },
                    { name: "Russian", value: "ru" }
                )))
        .addSubcommand(sub => sub.setName("view").setDescription("View voice announcement settings"))
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
            await svc.updateSettings(interaction.guildId, { voiceAnnounce: enabled } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(enabled ? "Ì¥ä Voice Announcements Enabled" : "Ì¥ä Voice Announcements Disabled")
                .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
                .setDescription(enabled 
                    ? "Track titles will be announced via voice (TTS) when they start playing."
                    : "Voice announcements are now disabled.")] });
        } else if (sub === "volume") {
            const level = interaction.options.getInteger("level", true);
            await svc.updateSettings(interaction.guildId, { voiceAnnounceVolume: level } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì¥ä Voice Announcement Volume Set")
                .setColor(0x2ecc71)
                .setDescription(`Voice announcement volume set to **${level}%**.`)] });
        } else if (sub === "language") {
            const lang = interaction.options.getString("lang", true);
            await svc.updateSettings(interaction.guildId, { voiceAnnounceLang: lang } as any);

            const langNames: Record<string, string> = {
                en: "English", es: "Spanish", fr: "French", de: "German",
                ja: "Japanese", ko: "Korean", pt: "Portuguese", ru: "Russian"
            };

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ìºê Voice Announcement Language Set")
                .setColor(0x2ecc71)
                .setDescription(`Voice announcements will use **${langNames[lang]}**.`)] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("Ì¥ä Voice Announcement Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Status", value: extSettings.voiceAnnounce ? "‚úÖ Enabled" : "‚ùå Disabled", inline: true },
                    { name: "Volume", value: `${extSettings.voiceAnnounceVolume || 80}%`, inline: true },
                    { name: "Language", value: extSettings.voiceAnnounceLang?.toUpperCase() || "EN", inline: true }
                )
                .setDescription("Voice announcements use text-to-speech to announce track information.");

            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default voiceannounce;
