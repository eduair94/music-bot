import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

// User preferences are stored per-user - we'll use a simple in-memory map
// In production, this would be stored in MongoDB
const userPrefs = new Map<string, {
    autoCorrect?: boolean;
    preferredBots?: string[];
    volumeAutomatic?: boolean;
    defaultVolume?: number;
}>();

const userprefs: Command = {
    data: new SlashCommandBuilder()
        .setName("userprefs")
        .setDescription("Configure your personal preferences")
        .addSubcommand(sub => sub.setName("autocorrect").setDescription("Toggle auto-correct for searches")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable auto-correct").setRequired(true)))
        .addSubcommand(sub => sub.setName("volumeautomatic").setDescription("Toggle automatic volume adjustment")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable automatic volume").setRequired(true)))
        .addSubcommand(sub => sub.setName("defaultvolume").setDescription("Set your default volume")
            .addIntegerOption(opt => opt.setName("volume").setDescription("Default volume (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)))
        .addSubcommand(sub => sub.setName("preferredbots").setDescription("Set your preferred bots")
            .addStringOption(opt => opt.setName("bots").setDescription("Bot names (comma separated)").setRequired(true)))
        .addSubcommand(sub => sub.setName("view").setDescription("View your preferences"))
        .addSubcommand(sub => sub.setName("reset").setDescription("Reset all preferences")),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        // Get or create user prefs
        if (!userPrefs.has(userId)) {
            userPrefs.set(userId, {});
        }
        const prefs = userPrefs.get(userId)!;

        if (sub === "autocorrect") {
            const enabled = interaction.options.getBoolean("enabled", true);
            prefs.autoCorrect = enabled;

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(enabled ? "‚úÖ Auto-Correct Enabled" : "‚ùå Auto-Correct Disabled")
                .setColor(enabled ? 0x2ecc71 : 0xe74c3c)
                .setDescription(enabled 
                    ? "Your search queries will be auto-corrected for typos."
                    : "Search queries will be used exactly as typed.")], ephemeral: true });
        } else if (sub === "volumeautomatic") {
            const enabled = interaction.options.getBoolean("enabled", true);
            prefs.volumeAutomatic = enabled;

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(enabled ? "Ì¥ä Automatic Volume Enabled" : "Ì¥ä Automatic Volume Disabled")
                .setColor(0x2ecc71)
                .setDescription(enabled 
                    ? "Volume will automatically adjust based on track loudness."
                    : "Volume will remain at a fixed level.")], ephemeral: true });
        } else if (sub === "defaultvolume") {
            const volume = interaction.options.getInteger("volume", true);
            prefs.defaultVolume = volume;

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì¥ä Default Volume Set")
                .setColor(0x2ecc71)
                .setDescription(`Your default volume is now **${volume}%**.`)], ephemeral: true });
        } else if (sub === "preferredbots") {
            const bots = interaction.options.getString("bots", true);
            prefs.preferredBots = bots.split(",").map(b => b.trim()).filter(b => b.length > 0);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì¥ñ Preferred Bots Set")
                .setColor(0x2ecc71)
                .setDescription(`Your preferred bots: ${prefs.preferredBots.map(b => `**${b}**`).join(", ")}`)], ephemeral: true });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("‚öôÔ∏è Your Preferences")
                .setColor(0x3498db)
                .addFields(
                    { name: "Auto-Correct", value: prefs.autoCorrect ? "‚úÖ Enabled" : "‚ùå Disabled", inline: true },
                    { name: "Automatic Volume", value: prefs.volumeAutomatic ? "‚úÖ Enabled" : "‚ùå Disabled", inline: true },
                    { name: "Default Volume", value: `${prefs.defaultVolume || 80}%`, inline: true },
                    { name: "Preferred Bots", value: prefs.preferredBots?.length ? prefs.preferredBots.join(", ") : "None set", inline: false }
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (sub === "reset") {
            userPrefs.set(userId, {});

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì¥Ñ Preferences Reset")
                .setColor(0x2ecc71)
                .setDescription("All your preferences have been reset to defaults.")], ephemeral: true });
        }
    }
};

export default userprefs;
