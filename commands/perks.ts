import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../interfaces/Command";
import { PatreonService } from "../services/patreon";
import { i18n } from "../utils/i18n";
import { buildPerksOverview } from "../utils/perksEmbed";

const perks: Command = {
    data: new SlashCommandBuilder()
        .setName("perks")
        .setDescription(i18n.__("perks.description"))
        .addSubcommand(sub => sub.setName("view").setDescription(i18n.__("perks.view.description")))
        .addSubcommand(sub => sub.setName("user").setDescription(i18n.__("perks.user.description"))) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "view") {
            await interaction.reply({ embeds: [buildPerksOverview()] });
        } else if (sub === "user") {
            const patreon = PatreonService.getInstance();
            const isPremium = await patreon.isPremiumUser(interaction.user.id);
            const features = await patreon.getPremiumFeatures(interaction.user.id);
            const bitrate = await patreon.getAudioBitrate(interaction.user.id);
            const embed = new EmbedBuilder().setTitle(i18n.__("perks.user.title")).setColor(isPremium ? 0xf96854 : 0x95a5a6);
            if (isPremium) {
                embed.setDescription(i18n.__mf("perks.user.premium", { tier: features.tier || i18n.__("perks.user.premiumTier") }));
                const featureList = [];
                featureList.push(i18n.__mf("perks.user.audio", { bitrate }));
                if (features.features.includes("audio_filters")) featureList.push(i18n.__("perks.user.audioFilters"));
                if (features.features.includes("stay_24_7")) featureList.push(i18n.__("perks.user.stay247"));
                embed.addFields({ name: i18n.__("perks.user.title"), value: featureList.join("\n") });
            } else {
                embed.setDescription(i18n.__("perks.user.free"));
            }
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};

export default perks;
