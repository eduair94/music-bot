import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { FOUNDER_PRICE_USD, FOUNDER_SPOTS, PATREON_URL } from "../shared/links";
import { PREMIUM_FEATURES, PremiumFeature } from "./premiumFeatures";

/**
 * One reply for every premium wall: what the user just hit, what Founder
 * costs, and the two steps that turn a pledge into working perks. Before this,
 * each gate wrote its own message with no price, no link and no next step.
 */
export function premiumUpsell(feature: PremiumFeature) {
  const embed = new EmbedBuilder()
    .setTitle(`${PREMIUM_FEATURES[feature]} is a Founder perk`)
    .setColor(0xf8aa2a)
    .setDescription(
      `Founder is $${FOUNDER_PRICE_USD}/month, limited to ${FOUNDER_SPOTS} spots, and unlocks 320kbps audio, ` +
        `audio filters, 24/7 mode, priority queue, unlimited playlists and the Founder role.`
    )
    .addFields({
      name: "After you join",
      value: "1. link your Discord account in your Patreon settings\n2. run `/premium link` in this server",
    });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel("Become a Founder").setStyle(ButtonStyle.Link).setURL(PATREON_URL)
  );

  return { embeds: [embed], components: [row], ephemeral: true as const };
}
