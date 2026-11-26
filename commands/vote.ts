import { ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ContainerBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { TOPGG_VOTE_URL } from "../shared/links";
import { votePerksUntil } from "../services/votes";
import { formatDuration } from "../utils/format";
import { i18n } from "../utils/i18n";

/** Listing sites with a public vote page, shown once their token is configured (= listed). */
const VOTE_PAGES: { name: string; env: string; url: string }[] = [
  { name: "top.gg", env: "TOPGG_TOKEN", url: TOPGG_VOTE_URL },
  { name: "discordbotlist.com", env: "DISCORDBOTLIST_TOKEN", url: "https://discordbotlist.com/bots/bypass-hi-fi-music-bot/upvote" },
  { name: "discords.com", env: "DISCORDS_TOKEN", url: "https://discords.com/bots/bot/1315125264786653225/vote" },
  { name: "botlist.me", env: "BOTLISTME_TOKEN", url: "https://botlist.me/bots/1315125264786653225/vote" }
];

/** /vote — vote links and the state of your vote perks (24/7 + studio quality for 12 h). */
export default {
  data: new SlashCommandBuilder().setName("vote").setDescription(i18n.__("vote.description")),
  cooldown: 3,
  category: "premium",
  userInstallable: true,
  async execute(interaction: ChatInputCommandInteraction) {
    const bot = interaction.client.user.username;
    const listed = VOTE_PAGES.filter((p) => process.env[p.env] || process.env[`${p.env.replace("_TOKEN", "")}_VOTE_URL`]);

    const container = new ContainerBuilder()
      .setAccentColor(0xf8aa2a)
      .addTextDisplayComponents((t) => t.setContent(`## 🗳️ ${i18n.__mf("vote.title", { bot })}`));

    if (listed.length === 0) {
      container.addTextDisplayComponents((t) => t.setContent(i18n.__("vote.notListed")));
      return interaction.reply({ components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const until = await votePerksUntil(interaction.user.id);
    const status = until > Date.now()
      ? `✅ ${i18n.__mf("vote.active", { time: formatDuration(until - Date.now()) })}`
      : `⏳ ${i18n.__("vote.inactive")}`;

    container
      .addTextDisplayComponents((t) => t.setContent(i18n.__("vote.body")))
      .addTextDisplayComponents((t) => t.setContent(status))
      .addActionRowComponents((row) =>
        row.setComponents(
          ...listed.slice(0, 5).map((p) =>
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(p.name).setURL(process.env[`${p.env.replace("_TOKEN", "")}_VOTE_URL`] || p.url)
          )
        )
      );
    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 } as any);
  }
};
