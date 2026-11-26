import { EmbedBuilder } from "discord.js";
import { FOUNDER_PRICE_USD, FOUNDER_SPOTS, PATREON_URL } from "../shared/links";
import { i18n } from "./i18n";

/**
 * The two plans Patreon actually sells, rendered for `/perks view`. The old
 * version looped over PREMIUM_TIERS and advertised Pro and Enterprise, which
 * nobody can buy.
 */
export function buildPerksOverview(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(i18n.__("perks.overview.title"))
    .setColor(0xf8aa2a)
    .setDescription(
      `${i18n.__mf("perks.overview.intro", { spots: FOUNDER_SPOTS })}\n[${i18n.__("upsell.becomeFounder")}](${PATREON_URL})`
    )
    .addFields(
      {
        name: i18n.__mf("perks.overview.freeName", { price: "$0" }),
        value: i18n.__("perks.overview.freePerks"),
        inline: true
      },
      {
        name: i18n.__mf("perks.overview.founderName", { price: `$${FOUNDER_PRICE_USD}` }),
        value: i18n.__("perks.overview.founderPerks"),
        inline: true
      }
    );
}
