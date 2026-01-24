import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../interfaces/Command";
import { PatreonService } from "../services/patreon";
import { i18n } from "../utils/i18n";
import { PREMIUM_TIERS } from "../shared/types";

const perks: Command = {
    data: new SlashCommandBuilder()
        .setName("perks")
        .setDescription("View premium perks")
        .addSubcommand(sub => sub.setName("view").setDescription("View available perks"))
        .addSubcommand(sub => sub.setName("user").setDescription("View your current perks")) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "view") {
            const embed = new EmbedBuilder().setTitle("Premium Perks").setColor(0xf96854)
                .setDescription("Upgrade to unlock features!");
            for (const [key, cfg] of Object.entries(PREMIUM_TIERS)) {
                if (key === "free") continue;
                const features = [];
                features.push(`Audio: ${cfg.audioBitrate}kbps`);
                if (cfg.audioFilters) features.push("Audio filters");
                if (cfg.stayMode) features.push("24/7 mode");
                features.push(`${cfg.maxLinkedBots} linked bot(s)`);
                embed.addFields({ name: `${cfg.name} - $${(cfg.minPledgeCents / 100).toFixed(2)}/mo`, value: features.join("\n"), inline: true });
            }
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "user") {
            const patreon = PatreonService.getInstance();
            const isPremium = await patreon.isPremiumUser(interaction.user.id);
            const features = await patreon.getPremiumFeatures(interaction.user.id);
            const bitrate = await patreon.getAudioBitrate(interaction.user.id);
            const embed = new EmbedBuilder().setTitle("Your Perks").setColor(isPremium ? 0xf96854 : 0x95a5a6);
            if (isPremium) {
                embed.setDescription(`You have **${features.tier || "Premium"}**!`);
                const featureList = [];
                featureList.push(`Audio: ${bitrate}kbps`);
                if (features.features.includes("audio_filters")) featureList.push("Audio filters");
                if (features.features.includes("stay_24_7")) featureList.push("24/7 mode");
                embed.addFields({ name: "Your Perks", value: featureList.join("\n") });
            } else {
                embed.setDescription("You are on the **Free** tier. Get premium on Patreon!");
            }
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};

export default perks;
