import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  MessageFlags,
  SlashCommandBuilder
} from "discord.js";
import type { ICollection } from "../models/Collection";
import { collectionService, MAX_COLLECTION_TRACKS } from "../services/collection";
import { loadCollection } from "../services/collectionPlayback";
import { buildCollectionView } from "../services/collectionView";
import { DatabaseService } from "../services/database";
import {
  connectedAccounts,
  LibraryError,
  LibraryPlaylist,
  libraryKey,
  libraryProviders,
  listPlaylists,
  parseLibraryKey,
  playlistTracks,
  providerLabel
} from "../services/linkedAccounts";
import { CONNECTIONS_PAGE_PATH, LinkProvider } from "../shared/linkedAccounts";
import { botSiteLink } from "../shared/growth";
import { SITE_URL } from "../shared/links";
import { safeText, truncate } from "../utils/format";
import { descriptionLocalizations, i18n } from "../utils/i18n";

/**
 * /library — play and import your own Spotify / YouTube playlists and liked
 * songs, from the accounts connected on the dashboard (/profile). Hidden
 * until an OAuth client and LINKED_ACCOUNTS_KEY are configured.
 */

const EPHEMERAL = MessageFlags.Ephemeral;
const V2 = MessageFlags.IsComponentsV2;
const NO_PINGS = { parse: [] as [] };
// UTM params go before the #connections fragment (URL keeps the hash last).
const CONNECT_URL = botSiteLink(SITE_URL, CONNECTIONS_PAGE_PATH, "library");

/** Playlist lists per user, kept briefly so autocomplete doesn't hit the APIs on every keystroke. */
const listCache = new Map<string, { at: number; items: LibraryPlaylist[] }>();
const LIST_TTL_MS = 2 * 60 * 1000;

async function cachedPlaylists(userId: string): Promise<LibraryPlaylist[]> {
  const hit = listCache.get(userId);
  if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.items;
  const accounts = await connectedAccounts(userId);
  const available = new Set(libraryProviders());
  const lists = await Promise.all(
    accounts
      .filter((a) => available.has(a.provider))
      .map((a) => listPlaylists(userId, a.provider).catch(() => [] as LibraryPlaylist[]))
  );
  const items = lists.flat();
  listCache.set(userId, { at: Date.now(), items });
  if (listCache.size > 1000) listCache.delete(listCache.keys().next().value as string);
  return items;
}

function playlistName(p: LibraryPlaylist): string {
  if (p.id === "liked") return p.provider === "spotify" ? i18n.__("library.likedSpotify") : i18n.__("library.likedYouTube");
  return p.name;
}

function connectRow(label: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(CONNECT_URL).setLabel(label));
}

function errorReply(error: unknown, provider?: LinkProvider): InteractionReplyOptions {
  const code = error instanceof LibraryError ? error.code : "failed";
  if (!(error instanceof LibraryError) || code === "failed") console.error("[library] failed:", error);
  const service = provider ? providerLabel(provider) : "";
  switch (code) {
    case "notConnected":
      return { content: `🔗 ${i18n.__mf("library.notConnected", { service })}`, components: [connectRow(i18n.__("library.connect"))], flags: EPHEMERAL };
    case "revoked":
      return { content: `🔗 ${i18n.__mf("library.revoked", { service })}`, components: [connectRow(i18n.__("library.reconnect"))], flags: EPHEMERAL };
    case "forbidden":
      return { content: `🔒 ${i18n.__mf("library.forbidden", { service })}`, flags: EPHEMERAL };
    default:
      return { content: `⚠️ ${i18n.__("library.failed")}`, flags: EPHEMERAL };
  }
}

function described<T extends { setDescription(text: string): T; setDescriptionLocalizations(map: Record<string, string> | null): T }>(
  builder: T,
  key: string
): T {
  return builder.setDescription(i18n.__(key)).setDescriptionLocalizations(descriptionLocalizations(key) ?? null);
}

const playlistOption = (opt: any) => described(opt.setName("playlist"), "library.playlistOption").setRequired(true).setAutocomplete(true);

export default {
  data: new SlashCommandBuilder()
    .setName("library")
    .setDescription(i18n.__("library.description"))
    .setDescriptionLocalizations(descriptionLocalizations("library.description") ?? null)
    .addSubcommand((sub) => described(sub.setName("accounts"), "library.accounts.description"))
    .addSubcommand((sub) =>
      described(sub.setName("play"), "library.play.description")
        .addStringOption(playlistOption)
        .addBooleanOption((opt) => described(opt.setName("next"), "playlists.play.nextOption"))
    )
    .addSubcommand((sub) =>
      described(sub.setName("import"), "library.import.description")
        .addStringOption(playlistOption)
        .addStringOption((opt) => described(opt.setName("name"), "collections.import.nameOption").setMaxLength(100))
    ),
  category: "playlists",
  cooldown: 5,
  isAvailable: () => libraryProviders().length > 0,

  async autocomplete(interaction: AutocompleteInteraction) {
    if (interaction.options.getFocused(true).name !== "playlist" || !DatabaseService.getInstance().isReady()) return interaction.respond([]);
    const typed = String(interaction.options.getFocused() ?? "").toLowerCase().trim();
    const items = await cachedPlaylists(interaction.user.id).catch(() => []);
    return interaction.respond(
      items
        .filter((p) => !typed || playlistName(p).toLowerCase().includes(typed))
        .slice(0, 25)
        .map((p) => {
          const count = p.count === null ? "" : ` · ${i18n.__mf("collections.trackCount", { count: p.count })}`;
          return { name: truncate(`${p.id === "liked" ? "❤️" : "🎵"} ${providerLabel(p.provider)} · ${playlistName(p)}${count}`, 100), value: libraryKey(p) };
        })
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;
    if (!DatabaseService.getInstance().isReady()) return interaction.reply({ content: `⚠️ ${i18n.__("collections.error")}`, flags: EPHEMERAL });
    const sub = interaction.options.getSubcommand();
    if (sub === "accounts") return showAccounts(interaction);

    const key = parseLibraryKey(interaction.options.getString("playlist", true));
    if (!key) return interaction.reply({ content: `🔍 ${i18n.__("library.pickFromList")}`, flags: EPHEMERAL });

    await interaction.deferReply(sub === "import" ? { flags: EPHEMERAL } : {});
    let fetched;
    try {
      fetched = await playlistTracks(interaction.user.id, key.provider, key.id, MAX_COLLECTION_TRACKS);
    } catch (error) {
      const reply = errorReply(error, key.provider);
      return interaction.editReply({ content: reply.content, components: reply.components ?? [] } as any);
    }
    if (fetched.tracks.length === 0) return interaction.editReply({ content: `📭 ${i18n.__("library.empty")}` });
    const label = key.id === "liked" ? playlistName({ provider: key.provider, id: "liked", name: "", count: null }) : fetched.name;

    if (sub === "import") {
      const userId = interaction.user.id;
      if (!(await collectionService.canCreateCollection(userId))) return interaction.editReply({ content: i18n.__("collections.create.limitReached") });
      const name = truncate(interaction.options.getString("name")?.trim() || label, 100);
      if (await collectionService.getByName(userId, name)) {
        return interaction.editReply({ content: i18n.__mf("collections.import.exists", { name: safeText(name, 100) }), allowedMentions: NO_PINGS });
      }
      const { collection } = await collectionService.createFromTracks(userId, name, fetched.tracks);
      return interaction.editReply({
        components: [buildCollectionView(collection, 0, `📥 ${i18n.__mf("library.imported", { name: safeText(name, 100), count: collection.tracks.length })}`)],
        flags: V2,
        allowedMentions: NO_PINGS
      } as any);
    }

    // Play: an unsaved collection through the collection loader (same checks as /play).
    const now = new Date();
    const asCollection = {
      _id: `library-${key.provider}-${key.id}`,
      userId: interaction.user.id,
      name: label,
      tracks: fetched.tracks.map((t) => ({ ...t, addedAt: now, addedBy: interaction.user.id })),
      isPublic: false,
      createdAt: now,
      updatedAt: now
    } as unknown as ICollection;
    return loadCollection(interaction, asCollection, interaction.options.getBoolean("next") ? "next" : "end", false);
  }
};

async function showAccounts(interaction: ChatInputCommandInteraction<"cached">) {
  const accounts = await connectedAccounts(interaction.user.id);
  const available = libraryProviders();
  const lines = available.map((provider) => {
    const account = accounts.find((a) => a.provider === provider);
    return account
      ? `✅ **${providerLabel(provider)}** · ${safeText(account.displayName || "", 60)}`
      : `➖ **${providerLabel(provider)}** · ${i18n.__("library.notLinked")}`;
  });
  lines.push("", `-# ${i18n.__("library.howTo")}`);
  return interaction.reply({
    content: lines.join("\n"),
    components: [connectRow(i18n.__("library.manage"))],
    flags: EPHEMERAL,
    allowedMentions: NO_PINGS
  });
}
