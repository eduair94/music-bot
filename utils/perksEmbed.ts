import { EmbedBuilder } from "discord.js";
import { FOUNDER_PRICE_USD, FOUNDER_SPOTS, PATREON_URL } from "../shared/links";

/**
 * The two plans Patreon actually sells, rendered for `/perks view`. The old
 * version looped over PREMIUM_TIERS and advertised Pro and Enterprise, which
 * nobody can buy.
 */
export function buildPerksOverview(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("Premium perks")
    .setColor(0xf8aa2a)
    .setDescription(
      `Founder is limited to ${FOUNDER_SPOTS} spots and the price is locked in.\n[Become a Founder](${PATREON_URL})`
    )
    .addFields(
      {
        name: "Free — $0",
        value: ["128kbps audio", "Queue, playlists and lyrics", "Every command"].join("\n"),
        inline: true
      },
      {
        name: `Founder / Beta Tester — $${FOUNDER_PRICE_USD}/month`,
        value: [
          "320kbps audio",
          "Audio filters",
          "24/7 mode",
          "Priority queue",
          "Founder role and direct support"
        ].join("\n"),
        inline: true
      }
    );
}
