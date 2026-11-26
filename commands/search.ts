import {
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from "discord.js";
import { searchYouTube, VideoResult } from "../services/youtubeSearch";
import { registerComponentHandler } from "../structs/componentRouter";
import { linkLabel, safeText, truncate } from "../utils/format";
import { i18n } from "../utils/i18n";
import { runPlay } from "../utils/playFlow";

/**
 * /search — pick one or more results from a menu. The menu's custom id
 * carries a short token for the stored results, so it is handled by the
 * persistent component router (no collector to time out, no double reply).
 */
const pending = new Map<string, { userId: string; results: VideoResult[]; at: number }>();
const TTL_MS = 10 * 60 * 1000;

function remember(userId: string, results: VideoResult[]): string {
  const token = Math.random().toString(36).slice(2, 10);
  pending.set(token, { userId, results, at: Date.now() });
  for (const [key, value] of pending) if (Date.now() - value.at > TTL_MS) pending.delete(key);
  return token;
}

registerComponentHandler("search", async (interaction, args) => {
  if (!interaction.isStringSelectMenu() || !interaction.inCachedGuild()) return;
  const entry = pending.get(args[0]);
  if (!entry) {
    return interaction.reply({ content: i18n.__("router.expired"), flags: MessageFlags.Ephemeral });
  }
  if (entry.userId !== interaction.user.id) {
    return interaction.reply({ content: i18n.__("router.expired"), flags: MessageFlags.Ephemeral });
  }
  pending.delete(args[0]);

  const picked = interaction.values
    .map((id) => entry.results.find((r) => r.id === id))
    .filter((r): r is VideoResult => Boolean(r));

  // Close the menu, then queue the picks in the order chosen.
  const done = new ContainerBuilder()
    .setAccentColor(0xf8aa2a)
    .addTextDisplayComponents((t) => t.setContent(picked.map((r) => `🎵 [${linkLabel(r.title, 70)}](${r.url})`).join("\n") || "—"));
  await interaction.update({ components: [done] } as any);

  for (const result of picked) {
    await runPlay({ interaction, query: result.url, ephemeral: true });
  }
});

export default {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription(i18n.__("search.description"))
    .addStringOption((option) => option.setName("query").setDescription(i18n.__("search.optionQuery")).setRequired(true)),
  cooldown: 3,
  category: "music",
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const query = interaction.options.getString("query", true);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let results: VideoResult[] = [];
    try {
      results = await searchYouTube(query, 10);
    } catch (error) {
      console.error("[search] failed:", error);
    }
    if (results.length === 0) {
      return interaction.editReply({ content: `🔍 ${i18n.__("search.noResults")}` });
    }

    const token = remember(interaction.user.id, results);
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`search:${token}`)
      .setPlaceholder("🎵")
      .setMinValues(1)
      .setMaxValues(results.length)
      .addOptions(
        results.map((r) => ({
          label: truncate(r.title, 100),
          description: truncate(`${r.author}${r.durationText ? ` · ${r.durationText}` : ""}`, 100),
          value: r.id
        }))
      );

    const container = new ContainerBuilder()
      .setAccentColor(0xf8aa2a)
      .addTextDisplayComponents((t) => t.setContent(`### 🔍 ${safeText(query, 80)}`))
      .addTextDisplayComponents((t) =>
        t.setContent(
          results
            .map((r, i) => `\`${i + 1}.\` [${linkLabel(r.title, 70)}](${r.url}) · ${safeText(r.author, 40)}${r.durationText ? ` · \`${r.durationText}\`` : ""}`)
            .join("\n")
        )
      )
      .addActionRowComponents((row) => row.setComponents(menu));

    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 } as any);
  }
};
