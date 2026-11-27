import { ButtonBuilder, ButtonStyle, ContainerBuilder, SeparatorSpacingSize, StringSelectMenuBuilder } from "discord.js";
import type { ICollection } from "../models/Collection";
import { formatDuration, isHttpUrl, linkLabel, safeText, truncate } from "../utils/format";
import { i18n } from "../utils/i18n";
import type { CollectionSummary } from "./collection";

/**
 * /collections as Components V2 messages. Every button and menu carries what
 * it needs in its custom id (`collections:page:<id>:<page>`,
 * `collections:play:<id>`, `collections:add:<id>`, `collections:open:<owner>`),
 * so they keep working on old messages and after restarts.
 */
export const COLLECTION_PAGE_SIZE = 10;
/** Collections shown (and selectable) in the list: a select menu holds 25 options. */
const LIST_LIMIT = 25;
const ACCENT = 0xf8aa2a;

const SOURCE_NAMES: [RegExp, string][] = [
  [/(^|\.)spotify\.com$/, "Spotify"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)deezer\.(com|page\.link)$/, "Deezer"],
  [/(^|\.)apple\.com$/, "Apple Music"],
  [/(^|\.)soundcloud\.com$/, "SoundCloud"],
];

function sourceName(url: string): string {
  const host = new URL(url).hostname.toLowerCase();
  return SOURCE_NAMES.find(([pattern]) => pattern.test(host))?.[1] ?? host;
}

function trackLine(n: number, title: string, author: string, url: string, durationSec: number): string {
  const label =
    isHttpUrl(url) && url.length <= 300 ? `[${linkLabel(title, 60)}](${url.replace(/\)/g, "%29")})` : safeText(title, 60);
  const by = author && author !== "Unknown" ? ` · ${safeText(author, 40)}` : "";
  const length = durationSec > 0 ? ` · \`${formatDuration(durationSec * 1000)}\`` : "";
  return `\`${String(n).padStart(2, " ")}.\` ${label}${by}${length}`;
}

/** One page of a collection, with page buttons and Play / Add to queue. */
export function buildCollectionView(collection: ICollection, page: number, notice?: string): ContainerBuilder {
  const id = String(collection._id);
  const tracks = collection.tracks;
  const pages = Math.max(1, Math.ceil(tracks.length / COLLECTION_PAGE_SIZE));
  const current = Math.min(Math.max(0, Math.floor(page) || 0), pages - 1);

  const container = new ContainerBuilder().setAccentColor(ACCENT);
  if (notice) container.addTextDisplayComponents((t) => t.setContent(notice));

  const head = [`### 📁 ${safeText(collection.name, 100)}`];
  if (collection.description) head.push(safeText(collection.description, 300));
  container.addTextDisplayComponents((t) => t.setContent(head.join("\n")));
  container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  if (tracks.length === 0) {
    container.addTextDisplayComponents((t) => t.setContent(i18n.__("collections.view.empty")));
  } else {
    const start = current * COLLECTION_PAGE_SIZE;
    const lines = tracks
      .slice(start, start + COLLECTION_PAGE_SIZE)
      .map((t, i) => trackLine(start + i + 1, t.title, t.author, t.url, t.duration));
    container.addTextDisplayComponents((t) => t.setContent(lines.join("\n")));
  }

  const totalSeconds = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const footer = [i18n.__mf("collections.view.summary", { count: tracks.length, duration: formatDuration(totalSeconds * 1000) })];
  if (collection.shareCode) footer.push(`🔗 ${i18n.__("collections.view.shareCodeField")}: \`${collection.shareCode}\``);
  if (collection.sourceUrl && isHttpUrl(collection.sourceUrl)) {
    footer.push(`[${linkLabel(i18n.__mf("collections.view.importedFrom", { source: sourceName(collection.sourceUrl) }), 60)}](${collection.sourceUrl.replace(/\)/g, "%29")})`);
  }
  if (pages > 1) footer.push(i18n.__mf("collections.view.page", { page: current + 1, pages }));
  container.addTextDisplayComponents((t) => t.setContent(`-# ${footer.join(" · ")}`));

  const buttons: ButtonBuilder[] = [];
  if (pages > 1) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`collections:page:${id}:${current - 1}`)
        .setEmoji("◀️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(current === 0),
      new ButtonBuilder()
        .setCustomId(`collections:page:${id}:${current + 1}`)
        .setEmoji("▶️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(current >= pages - 1)
    );
  }
  if (tracks.length > 0) {
    buttons.push(
      new ButtonBuilder().setCustomId(`collections:play:${id}`).setEmoji("🎶").setLabel(i18n.__("collections.view.play")).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`collections:add:${id}`).setEmoji("➕").setLabel(i18n.__("collections.view.addToQueue")).setStyle(ButtonStyle.Secondary)
    );
  }
  if (buttons.length > 0) container.addActionRowComponents((row) => row.setComponents(...buttons));
  return container;
}

/** The owner's collections with a menu to open one. */
export function buildCollectionList(ownerId: string, collections: CollectionSummary[]): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(ACCENT);
  container.addTextDisplayComponents((t) => t.setContent(`### ${i18n.__("collections.list.title")}`));

  if (collections.length === 0) {
    container.addTextDisplayComponents((t) => t.setContent(i18n.__("collections.list.empty")));
    return container;
  }

  const shown = collections.slice(0, LIST_LIMIT);
  const lines = shown.map(
    (c, i) =>
      `\`${String(i + 1).padStart(2, " ")}.\` **${safeText(c.name, 60)}** · ${i18n.__mf("collections.trackCount", { count: c.count })}${c.shared ? " 🔗" : ""}`
  );
  if (collections.length > shown.length) lines.push(i18n.__mf("collections.list.more", { count: collections.length - shown.length }));
  container.addTextDisplayComponents((t) => t.setContent(lines.join("\n")));
  container.addTextDisplayComponents((t) => t.setContent(`-# ${i18n.__mf("collections.list.footer", { count: collections.length })}`));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`collections:open:${ownerId}`)
    .setPlaceholder(truncate(i18n.__("collections.list.select"), 150))
    .addOptions(
      shown.map((c) => ({
        label: truncate(c.name, 100),
        description: truncate(i18n.__mf("collections.trackCount", { count: c.count }), 100),
        value: c.id,
      }))
    );
  container.addActionRowComponents((row) => row.setComponents(menu));
  return container;
}
