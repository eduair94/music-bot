import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { FOUNDER_PRICE_USD, FOUNDER_SPOTS, PATREON_URL, TOPGG_VOTE_URL } from "../shared/links";
import { i18n } from "./i18n";
import { PremiumFeature, premiumFeatureName } from "./premiumFeatures";

/**
 * One reply for every premium wall: what the user just hit, what Founder
 * costs, and the two steps that turn a pledge into working perks. Before this,
 * each gate wrote its own message with no price, no link and no next step.
 */
export function premiumUpsell(feature: PremiumFeature) {
  const embed = new EmbedBuilder()
    .setTitle(i18n.__mf("upsell.title", { feature: premiumFeatureName(feature) }))
    .setColor(0xf8aa2a)
    .setDescription(i18n.__mf("upsell.description", { price: `$${FOUNDER_PRICE_USD}`, spots: FOUNDER_SPOTS }))
    .addFields({
      name: i18n.__("upsell.afterJoin"),
      value: i18n.__("upsell.afterJoinSteps"),
    });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel(i18n.__("upsell.becomeFounder")).setStyle(ButtonStyle.Link).setURL(PATREON_URL)
  );

  // Vote perks cover 24/7 and quality for 12 h, once the top.gg listing is live.
  if (process.env.TOPGG_TOKEN && (feature === "stay_24_7" || feature === "max_quality")) {
    embed.addFields({ name: i18n.__("upsell.voteTitle"), value: i18n.__("upsell.voteBody") });
    row.addComponents(new ButtonBuilder().setLabel(i18n.__("upsell.voteButton")).setStyle(ButtonStyle.Link).setURL(TOPGG_VOTE_URL));
  }

  return { embeds: [embed], components: [row], ephemeral: true as const };
}
