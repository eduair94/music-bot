import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const defaults: Command = {
    data: new SlashCommandBuilder()
        .setName("defaults")
        .setDescription("Configure default playback settings")
        .addSubcommand(sub => sub.setName("volume").setDescription("Set default volume")
            .addIntegerOption(opt => opt.setName("level").setDescription("Volume level (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)))
        .addSubcommand(sub => sub.setName("autoplay").setDescription("Set default autoplay")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable autoplay by default").setRequired(true)))
        .addSubcommand(sub => sub.setName("repeatqueue").setDescription("Set default repeat mode")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable queue repeat by default").setRequired(true)))
        .addSubcommand(sub => sub.setName("shuffle").setDescription("Set default shuffle")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable shuffle by default").setRequired(true)))
        .addSubcommand(sub => sub.setName("selectrandom").setDescription("Set default select random")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable random selection by default").setRequired(true)))
        .addSubcommand(sub => sub.setName("removeafterplayed").setDescription("Set default remove after played")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Remove tracks after played by default").setRequired(true)))
        .addSubcommand(sub => sub.setName("view").setDescription("View default settings"))
        .addSubcommand(sub => sub.setName("reset").setDescription("Reset all defaults"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const sub = interaction.options.getSubcommand();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);

        // Use extended settings type for defaults
        const extSettings = settings as any;

        if (sub === "volume") {
            const level = interaction.options.getInteger("level", true);
            await svc.updateSettings(interaction.guildId, { defaultVolume: level });
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("🔊 Default Volume Set")
                .setColor(0x2ecc71)
                .setDescription(`Default volume set to **${level}%**`)] });
        } else if (sub === "autoplay") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { defaultAutoplay: enabled } as any);
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("🔄 Default Autoplay")
                .setColor(0x2ecc71)
                .setDescription(enabled ? "Autoplay will be enabled by default" : "Autoplay will be disabled by default")] });
        } else if (sub === "repeatqueue") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { defaultRepeatQueue: enabled } as any);
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("🔁 Default Repeat Queue")
                .setColor(0x2ecc71)
                .setDescription(enabled ? "Queue repeat will be enabled by default" : "Queue repeat will be disabled by default")] });
        } else if (sub === "shuffle") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { defaultShuffle: enabled } as any);
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("🔀 Default Shuffle")
                .setColor(0x2ecc71)
                .setDescription(enabled ? "Shuffle will be enabled by default" : "Shuffle will be disabled by default")] });
        } else if (sub === "selectrandom") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { defaultSelectRandom: enabled } as any);
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("🎲 Default Select Random")
                .setColor(0x2ecc71)
                .setDescription(enabled ? "Random selection will be enabled by default" : "Random selection will be disabled by default")] });
        } else if (sub === "removeafterplayed") {
            const enabled = interaction.options.getBoolean("enabled", true);
            await svc.updateSettings(interaction.guildId, { defaultRemoveAfterPlayed: enabled } as any);
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("🗑️ Default Remove After Played")
                .setColor(0x2ecc71)
                .setDescription(enabled ? "Tracks will be removed after playing by default" : "Tracks will remain after playing by default")] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("⚙️ Default Playback Settings")
                .setColor(0x3498db)
                .addFields(
                    { name: "Volume", value: `${settings.defaultVolume}%`, inline: true },
                    { name: "Autoplay", value: extSettings.defaultAutoplay ? "✅" : "❌", inline: true },
                    { name: "Repeat Queue", value: extSettings.defaultRepeatQueue ? "✅" : "❌", inline: true },
                    { name: "Shuffle", value: extSettings.defaultShuffle ? "✅" : "❌", inline: true },
                    { name: "Select Random", value: extSettings.defaultSelectRandom ? "✅" : "❌", inline: true },
                    { name: "Remove After Played", value: extSettings.defaultRemoveAfterPlayed ? "✅" : "❌", inline: true }
                );
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "reset") {
            await svc.updateSettings(interaction.guildId, { 
                defaultVolume: 80, 
                defaultAutoplay: false, 
                defaultRepeatQueue: false, 
                defaultShuffle: false,
                defaultSelectRandom: false,
                defaultRemoveAfterPlayed: false
            } as any);
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("🔄 Defaults Reset")
                .setColor(0xf39c12)
                .setDescription("All default settings have been reset.")] });
        }
    }
};

export default defaults;
