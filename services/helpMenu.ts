import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorSpacingSize,
  StringSelectMenuBuilder
} from "discord.js";
import { CommandCategory } from "../interfaces/Command";
import { botSiteLink, trackedInviteUrl } from "../shared/growth";
import { PATREON_URL, SITE_URL, SUPPORT_INVITE_URL, TOPGG_VOTE_URL } from "../shared/links";
import { categoryOf, commandId, commands, mention } from "../structs/commandRegistry";
import { registerComponentHandler } from "../structs/componentRouter";
import { truncate } from "../utils/format";
import { currentLocale, i18n, ownTranslation } from "../utils/i18n";
import { isPrimary } from "../utils/instance";

const ORDER: CommandCategory[] = ["music", "queue", "effects", "playlists", "info", "settings", "premium", "other"];
const ICON: Record<CommandCategory, string> = {
  music: "🎵",
  queue: "📜",
  effects: "🎛️",
  playlists: "💾",
  info: "🎤",
  settings: "⚙️",
  premium: "⭐",
  other: "🧩"
};

/**
 * Translated description for "<name>.description" (a command, or
 * "<command>.<subcommand>" for a subcommand), else the builder's English.
 * Reads the catalogs directly: i18n.__ on a missing nested key writes it into
 * the in-memory catalog, which can replace a string parent with an object.
 */
function describe(name: string, fallback: string): string {
  const key = `${name}.description`;
  return ownTranslation(currentLocale(), key) ?? ownTranslation("en", key) ?? fallback;
}

/** Each subcommand as its own clickable mention; plain commands as one line. */
function linesFor(category: CommandCategory): string[] {
  const lines: string[] = [];
  for (const command of commands.values()) {
    if (categoryOf(command) !== category) continue;
    const json = command.data.toJSON() as any;
    const subs = (json.options || []).filter((o: any) => o.type === 1);
    if (subs.length > 0 && subs.length <= 6) {
      for (const sub of subs) lines.push(`${mention(json.name, sub.name)} — ${truncate(describe(`${json.name}.${sub.name}`, sub.description), 70)}`);
    } else {
      lines.push(`${mention(json.name)} — ${truncate(describe(json.name, json.description), 70)}`);
    }
  }
  return lines.sort();
}

export function buildHelp(botName: string, category?: CommandCategory): { components: (ContainerBuilder | ActionRowBuilder<any>)[] } {
  const container = new ContainerBuilder().setAccentColor(0xf8aa2a);
  container.addTextDisplayComponents((t) => t.setContent(`## ${i18n.__mf("helpMenu.title", { bot: botName })}`));

  if (!category) {
    const playId = commandId("play");
    const intro = playId
      ? i18n.__mf("helpMenu.intro", { playId })
      : i18n.__mf("helpMenu.intro", { playId: "0" }).replace("</play:0>", "/play");
    container.addTextDisplayComponents((t) => t.setContent(intro));
    container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    const overview = ORDER.filter((c) => linesFor(c).length > 0)
      .map((c) => `${ICON[c]} **${i18n.__(`helpMenu.category.${c}`)}** — ${i18n.__(`helpMenu.categoryDesc.${c}`)}`)
      .join("\n");
    container.addTextDisplayComponents((t) => t.setContent(overview));
    if (commands.has("feedback")) {
      container.addTextDisplayComponents((t) => t.setContent(`-# ${i18n.__mf("feedback.helpHint", { command: mention("feedback") })}`));
    }
  } else {
    const lines = linesFor(category);
    container.addTextDisplayComponents((t) => t.setContent(`### ${ICON[category]} ${i18n.__(`helpMenu.category.${category}`)}`));
    // A text display holds up to 4000 characters; split long categories.
    let chunk = "";
    for (const line of lines) {
      if ((chunk + "\n" + line).length > 3800) {
        const text = chunk;
        container.addTextDisplayComponents((t) => t.setContent(text));
        chunk = "";
      }
      chunk = chunk ? `${chunk}\n${line}` : line;
    }
    if (chunk) container.addTextDisplayComponents((t) => t.setContent(chunk));
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId("help:cat")
    .setPlaceholder(i18n.__("helpMenu.pick"))
    .addOptions(
      ORDER.filter((c) => linesFor(c).length > 0).map((c) => ({
        label: i18n.__(`helpMenu.category.${c}`),
        description: truncate(i18n.__(`helpMenu.categoryDesc.${c}`), 100),
        value: c,
        emoji: ICON[c],
        default: c === category
      }))
    );
  container.addActionRowComponents((row) => row.setComponents(select));
  const links = [
    new ButtonBuilder().setURL(botSiteLink(SITE_URL, "/", "help")).setLabel(i18n.__("links.website")).setStyle(ButtonStyle.Link),
    new ButtonBuilder().setURL(SUPPORT_INVITE_URL).setLabel(i18n.__("links.support")).setStyle(ButtonStyle.Link),
    new ButtonBuilder().setURL(PATREON_URL).setLabel(i18n.__("links.premium")).setStyle(ButtonStyle.Link)
  ];
  // The top.gg page 404s until the listing is approved (TOPGG_TOKEN is issued then).
  if (process.env.TOPGG_TOKEN) {
    links.splice(2, 0, new ButtonBuilder().setURL(TOPGG_VOTE_URL).setLabel(i18n.__("links.vote")).setStyle(ButtonStyle.Link));
  }
  // Add Bypass elsewhere, through the site so the join is attributed (private bots don't advertise Bypass).
  if (isPrimary) {
    links.unshift(new ButtonBuilder().setURL(trackedInviteUrl(SITE_URL, "bot-help")).setLabel(i18n.__("links.invite")).setStyle(ButtonStyle.Link));
  }
  container.addActionRowComponents((row) => row.setComponents(...links));

  return { components: [container] };
}

registerComponentHandler("help", async (interaction, args) => {
  const botName = interaction.client.user.username;
  if (args[0] === "open" && interaction.isButton()) {
    return interaction.reply({ ...buildHelp(botName), flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  }
  if (args[0] === "cat" && interaction.isStringSelectMenu()) {
    const category = interaction.values[0] as CommandCategory;
    return interaction.update({ ...buildHelp(botName, ORDER.includes(category) ? category : undefined) } as any);
  }
});
