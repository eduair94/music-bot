import { useQueue } from "discord-player";
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  MessageFlags,
  SlashCommandBuilder
} from "discord.js";
import { collectionService, MAX_COLLECTION_TRACKS } from "../services/collection";
import { ImportError, PLATFORM_NAMES, resolvePlaylist } from "../services/collectionImport";
import { loadCollection } from "../services/collectionPlayback";
import { buildCollectionList, buildCollectionView } from "../services/collectionView";
import { DatabaseService } from "../services/database";
import { serverOwnerKey } from "../services/serverPlaylists";
import { registerComponentHandler } from "../structs/componentRouter";
import { isHttpUrl, safeText, truncate } from "../utils/format";
import { descriptionLocalizations, i18n } from "../utils/i18n";

const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const NO_PINGS = { parse: [] as [] };

type CachedChatInput = ChatInputCommandInteraction<"cached">;

/** Description plus its translations, read from the locale files at load. */
function described<T extends { setDescription(text: string): T; setDescriptionLocalizations(map: Record<string, string> | null): T }>(
  builder: T,
  key: string
): T {
  return builder.setDescription(i18n.__(key)).setDescriptionLocalizations(descriptionLocalizations(key) ?? null);
}

const ephemeral = (content: string): InteractionReplyOptions => ({ content, flags: EPHEMERAL, allowedMentions: NO_PINGS });
const failed = () => ephemeral(`⚠️ ${i18n.__("collections.error")}`);

function databaseReady(): boolean {
  return DatabaseService.getInstance().isReady();
}

// ------------------------------------------------------------- components

registerComponentHandler("collections", async (interaction, args) => {
  if (!interaction.inCachedGuild() || !interaction.isMessageComponent()) return;
  if (!databaseReady()) return interaction.reply(failed());
  const [action, target, extra] = args;

  // List menu: open one of the owner's collections (privately, for the owner only).
  // Server playlists (/playlists list) open for anyone in that server.
  if (action === "open") {
    if (!interaction.isStringSelectMenu()) return;
    const serverList = target === serverOwnerKey(interaction.guildId);
    if (!serverList && interaction.user.id !== target) return interaction.reply(ephemeral(`🔒 ${i18n.__("collections.notYours")}`));
    const collection = await collectionService.getById(interaction.values[0]);
    // Re-render the list first: it refreshes the counts and resets the menu.
    const title = serverList ? i18n.__("playlists.list.title") : undefined;
    await interaction.update({ components: [buildCollectionList(target, await collectionService.listSummaries(target), title)], allowedMentions: NO_PINGS } as any);
    if (!collection || collection.userId !== target) return interaction.followUp(ephemeral(`📭 ${i18n.__("collections.gone")}`));
    return interaction.followUp({ components: [buildCollectionView(collection, 0)], flags: V2 | EPHEMERAL, allowedMentions: NO_PINGS } as any);
  }

  if (!interaction.isButton()) return;
  const collection = await collectionService.getById(target);
  if (!collection) return interaction.reply(ephemeral(`📭 ${i18n.__("collections.gone")}`));

  if (action === "page") {
    return interaction.update({ components: [buildCollectionView(collection, Number(extra) || 0)], allowedMentions: NO_PINGS } as any);
  }
  // Anyone who can see the message may queue it; they become the requester.
  if (action === "play" || action === "add") {
    return loadCollection(interaction, collection, action === "play" ? "next" : "end", true);
  }
  return interaction.reply(ephemeral(i18n.__("router.expired")));
});

// ---------------------------------------------------------------- command

/** Options whose value is one of the user's collections (autocompleted). */
const EXISTING_NAME_OPTIONS = new Set(["name", "old_name", "source", "target"]);
/** Subcommands whose `name` is a new collection: no suggestions. */
const NEW_NAME_SUBCOMMANDS = new Set(["create", "clone", "import"]);

export default {
  data: new SlashCommandBuilder()
    .setName("collections")
    .setDescription(i18n.__("collections.description"))
    .addSubcommand((sub) => described(sub.setName("list"), "collections.list.description"))
    .addSubcommand((sub) =>
      described(sub.setName("create"), "collections.create.description")
        .addStringOption((opt) => described(opt.setName("name"), "collections.create.nameOption").setRequired(true).setMaxLength(100))
        .addStringOption((opt) =>
          described(opt.setName("description"), "collections.create.descriptionOption").setRequired(false).setMaxLength(500)
        )
    )
    .addSubcommand((sub) =>
      described(sub.setName("delete"), "collections.delete.description").addStringOption((opt) =>
        described(opt.setName("name"), "collections.delete.nameOption").setRequired(true).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      described(sub.setName("view"), "collections.view.description").addStringOption((opt) =>
        described(opt.setName("name"), "collections.view.nameOption").setRequired(true).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      described(sub.setName("save"), "collections.save.description").addStringOption((opt) =>
        described(opt.setName("name"), "collections.save.nameOption").setRequired(true).setMaxLength(100).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      described(sub.setName("load"), "collections.load.description").addStringOption((opt) =>
        described(opt.setName("name"), "collections.load.nameOption").setRequired(true).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      described(sub.setName("import"), "collections.import.description")
        .addStringOption((opt) => described(opt.setName("url"), "collections.import.urlOption").setRequired(true).setMaxLength(500))
        .addStringOption((opt) => described(opt.setName("name"), "collections.import.nameOption").setRequired(false).setMaxLength(100))
    )
    .addSubcommand((sub) =>
      described(sub.setName("rename"), "collections.rename.description")
        .addStringOption((opt) => described(opt.setName("old_name"), "collections.rename.oldNameOption").setRequired(true).setAutocomplete(true))
        .addStringOption((opt) => described(opt.setName("new_name"), "collections.rename.newNameOption").setRequired(true).setMaxLength(100))
    )
    .addSubcommand((sub) =>
      described(sub.setName("share"), "collections.share.description").addStringOption((opt) =>
        described(opt.setName("name"), "collections.share.nameOption").setRequired(true).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      described(sub.setName("unshare"), "collections.unshare.description").addStringOption((opt) =>
        described(opt.setName("name"), "collections.unshare.nameOption").setRequired(true).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      described(sub.setName("clone"), "collections.clone.description")
        .addStringOption((opt) => described(opt.setName("share_code"), "collections.clone.shareCodeOption").setRequired(true))
        .addStringOption((opt) => described(opt.setName("name"), "collections.clone.nameOption").setRequired(true).setMaxLength(100))
    )
    .addSubcommand((sub) =>
      described(sub.setName("merge"), "collections.merge.description")
        .addStringOption((opt) => described(opt.setName("source"), "collections.merge.sourceOption").setRequired(true).setAutocomplete(true))
        .addStringOption((opt) => described(opt.setName("target"), "collections.merge.targetOption").setRequired(true).setAutocomplete(true))
    )
    .addSubcommand((sub) =>
      described(sub.setName("addcurrent"), "collections.addcurrent.description").addStringOption((opt) =>
        described(opt.setName("name"), "collections.addcurrent.nameOption").setRequired(true).setAutocomplete(true)
      )
    )
    .addSubcommand((sub) =>
      described(sub.setName("removetrack"), "collections.removetrack.description")
        .addStringOption((opt) => described(opt.setName("name"), "collections.removetrack.nameOption").setRequired(true).setAutocomplete(true))
        .addIntegerOption((opt) =>
          described(opt.setName("position"), "collections.removetrack.positionOption").setRequired(true).setMinValue(1)
        )
    ),

  category: "playlists",

  /** The user's own collections, filtered by what they typed. */
  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand(false) ?? "";
    if (!EXISTING_NAME_OPTIONS.has(focused.name) || NEW_NAME_SUBCOMMANDS.has(subcommand) || !databaseReady()) {
      return interaction.respond([]);
    }
    const typed = String(focused.value ?? "").toLowerCase().trim();
    const summaries = await collectionService.listSummaries(interaction.user.id);
    const choices = summaries
      .filter((c) => !typed || c.name.toLowerCase().includes(typed))
      .slice(0, 25)
      .map((c) => ({
        name: truncate(`${c.name} · ${i18n.__mf("collections.trackCount", { count: c.count })}`, 100),
        value: c.name.slice(0, 100)
      }));
    return interaction.respond(choices);
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;
    if (!databaseReady()) return interaction.reply(failed());
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    switch (subcommand) {
      case "list":
        return handleList(interaction, userId);
      case "create":
        return handleCreate(interaction, userId);
      case "delete":
        return handleDelete(interaction, userId);
      case "view":
        return handleView(interaction, userId);
      case "save":
        return handleSave(interaction, userId);
      case "load":
        return handleLoad(interaction, userId);
      case "import":
        return handleImport(interaction, userId);
      case "rename":
        return handleRename(interaction, userId);
      case "share":
        return handleShare(interaction, userId);
      case "unshare":
        return handleUnshare(interaction, userId);
      case "clone":
        return handleClone(interaction, userId);
      case "merge":
        return handleMerge(interaction, userId);
      case "addcurrent":
        return handleAddCurrent(interaction, userId);
      case "removetrack":
        return handleRemoveTrack(interaction, userId);
      default:
        return interaction.reply(failed());
    }
  }
};

/** Collection names are user text; keep them from breaking the message markdown. */
const nameOf = (name: string) => safeText(name, 100);

async function handleList(interaction: CachedChatInput, userId: string) {
  const collections = await collectionService.listSummaries(userId);
  if (collections.length === 0) return interaction.reply(ephemeral(i18n.__("collections.list.empty")));
  return interaction.reply({ components: [buildCollectionList(userId, collections)], flags: V2, allowedMentions: NO_PINGS } as any);
}

async function handleCreate(interaction: CachedChatInput, userId: string) {
  const name = interaction.options.getString("name", true).trim();
  const description = interaction.options.getString("description") || undefined;

  if (!(await collectionService.canCreateCollection(userId))) {
    return interaction.reply(ephemeral(i18n.__("collections.create.limitReached")));
  }
  if (await collectionService.getByName(userId, name)) {
    return interaction.reply(ephemeral(i18n.__mf("collections.create.exists", { name: nameOf(name) })));
  }

  try {
    await collectionService.create(userId, name, description);
    return interaction.reply({ content: i18n.__mf("collections.create.success", { name: nameOf(name) }), allowedMentions: NO_PINGS });
  } catch (error) {
    console.error("[collections] Error creating collection:", error);
    return interaction.reply(failed());
  }
}

async function handleDelete(interaction: CachedChatInput, userId: string) {
  const name = interaction.options.getString("name", true);
  if (!(await collectionService.delete(userId, name))) {
    return interaction.reply(ephemeral(i18n.__mf("collections.notFound", { name: nameOf(name) })));
  }
  return interaction.reply({ content: i18n.__mf("collections.delete.success", { name: nameOf(name) }), allowedMentions: NO_PINGS });
}

async function handleView(interaction: CachedChatInput, userId: string) {
  const name = interaction.options.getString("name", true);
  const collection = await collectionService.getByName(userId, name);
  if (!collection) return interaction.reply(ephemeral(i18n.__mf("collections.notFound", { name: nameOf(name) })));
  return interaction.reply({ components: [buildCollectionView(collection, 0)], flags: V2, allowedMentions: NO_PINGS } as any);
}

async function handleSave(interaction: CachedChatInput, userId: string) {
  const name = interaction.options.getString("name", true).trim();
  const queue = useQueue(interaction.guildId);

  if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
    return interaction.reply(ephemeral(i18n.__("collections.save.noQueue")));
  }

  // Check limit for new collections
  const existing = await collectionService.getByName(userId, name);
  if (!existing && !(await collectionService.canCreateCollection(userId))) {
    return interaction.reply(ephemeral(i18n.__("collections.create.limitReached")));
  }

  try {
    const collection = await collectionService.saveQueue(userId, name, queue.tracks.toArray(), queue.currentTrack || undefined);
    return interaction.reply({
      content: i18n.__mf("collections.save.success", { name: nameOf(name), count: collection.tracks.length }),
      allowedMentions: NO_PINGS
    });
  } catch (error) {
    console.error("[collections] Error saving collection:", error);
    return interaction.reply(failed());
  }
}

async function handleLoad(interaction: CachedChatInput, userId: string) {
  const name = interaction.options.getString("name", true);
  const collection = await collectionService.getByName(userId, name);
  if (!collection) return interaction.reply(ephemeral(i18n.__mf("collections.notFound", { name: nameOf(name) })));
  return loadCollection(interaction, collection, "end", false);
}

async function handleImport(interaction: CachedChatInput, userId: string) {
  const url = interaction.options.getString("url", true).trim();
  const requestedName = interaction.options.getString("name")?.trim() || null;

  if (!isHttpUrl(url)) return interaction.reply(ephemeral(`🔗 ${i18n.__("collections.import.invalidUrl")}`));
  if (!(await collectionService.canCreateCollection(userId))) {
    return interaction.reply(ephemeral(i18n.__("collections.create.limitReached")));
  }
  if (requestedName && (await collectionService.getByName(userId, requestedName))) {
    return interaction.reply(ephemeral(i18n.__mf("collections.import.exists", { name: nameOf(requestedName) })));
  }

  await interaction.deferReply();

  let playlist;
  try {
    playlist = await resolvePlaylist(url, interaction.user, MAX_COLLECTION_TRACKS);
  } catch (error) {
    if (error instanceof ImportError && error.code === "notReady") {
      return interaction.editReply({ content: `⏳ ${i18n.__("play.initializing")}` });
    }
    if (error instanceof ImportError && error.code === "invalidUrl") {
      return interaction.editReply({ content: `🔗 ${i18n.__("collections.import.invalidUrl")}` });
    }
    if (!(error instanceof ImportError)) console.error("[collections] Import failed:", error);
    return interaction.editReply({ content: `❌ ${i18n.__("collections.import.failed")}` });
  }
  if (playlist.tracks.length === 0) return interaction.editReply({ content: `❌ ${i18n.__("collections.import.failed")}` });

  const source = PLATFORM_NAMES[playlist.platform];
  const name = truncate(requestedName || playlist.title?.trim() || source, 100);
  if (!requestedName && (await collectionService.getByName(userId, name))) {
    return interaction.editReply({ content: i18n.__mf("collections.import.exists", { name: nameOf(name) }), allowedMentions: NO_PINGS });
  }

  let created;
  try {
    created = await collectionService.createFromTracks(userId, name, playlist.tracks, url);
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      return interaction.editReply({ content: i18n.__mf("collections.import.exists", { name: nameOf(name) }), allowedMentions: NO_PINGS });
    }
    console.error("[collections] Could not save imported playlist:", error);
    return interaction.editReply({ content: `⚠️ ${i18n.__("collections.error")}` });
  }

  const { collection, skipped: overLimit } = created;
  const skipped = overLimit + playlist.invalid;
  const notice = [i18n.__mf("collections.import.success", { count: collection.tracks.length, source, name: nameOf(name) })];
  if (skipped > 0) notice.push(`-# ${i18n.__mf("collections.import.skipped", { count: skipped, max: MAX_COLLECTION_TRACKS })}`);
  // Without API keys the Spotify extractor reads the public embed, which lists 100 songs at most.
  if (playlist.platform === "spotify" && playlist.tracks.length === 100) notice.push(`-# ${i18n.__("collections.import.spotifyCap")}`);

  return interaction.editReply({
    components: [buildCollectionView(collection, 0, notice.join("\n"))],
    flags: V2,
    allowedMentions: NO_PINGS
  } as any);
}

async function handleRename(interaction: CachedChatInput, userId: string) {
  const oldName = interaction.options.getString("old_name", true);
  const newName = interaction.options.getString("new_name", true).trim();

  if (await collectionService.getByName(userId, newName)) {
    return interaction.reply(ephemeral(i18n.__mf("collections.rename.exists", { name: nameOf(newName) })));
  }

  const collection = await collectionService.rename(userId, oldName, newName);
  if (!collection) return interaction.reply(ephemeral(i18n.__mf("collections.notFound", { name: nameOf(oldName) })));

  return interaction.reply({
    content: i18n.__mf("collections.rename.success", { oldName: nameOf(oldName), newName: nameOf(newName) }),
    allowedMentions: NO_PINGS
  });
}

async function handleShare(interaction: CachedChatInput, userId: string) {
  const name = interaction.options.getString("name", true);
  const shareCode = await collectionService.createShareCode(userId, name);
  if (!shareCode) return interaction.reply(ephemeral(i18n.__mf("collections.notFound", { name: nameOf(name) })));
  return interaction.reply({ content: i18n.__mf("collections.share.success", { name: nameOf(name), code: shareCode }), allowedMentions: NO_PINGS });
}

async function handleUnshare(interaction: CachedChatInput, userId: string) {
  const name = interaction.options.getString("name", true);
  const collection = await collectionService.removeShareCode(userId, name);
  if (!collection) return interaction.reply(ephemeral(i18n.__mf("collections.notFound", { name: nameOf(name) })));
  return interaction.reply({ content: i18n.__mf("collections.unshare.success", { name: nameOf(name) }), allowedMentions: NO_PINGS });
}

async function handleClone(interaction: CachedChatInput, userId: string) {
  const shareCode = interaction.options.getString("share_code", true).trim();
  const name = interaction.options.getString("name", true).trim();

  if (!(await collectionService.canCreateCollection(userId))) {
    return interaction.reply(ephemeral(i18n.__("collections.create.limitReached")));
  }
  if (await collectionService.getByName(userId, name)) {
    return interaction.reply(ephemeral(i18n.__mf("collections.create.exists", { name: nameOf(name) })));
  }

  try {
    const collection = await collectionService.cloneFromShareCode(userId, shareCode, name);
    if (!collection) return interaction.reply(ephemeral(i18n.__("collections.clone.invalidCode")));
    return interaction.reply({
      content: i18n.__mf("collections.clone.success", { name: nameOf(name), count: collection.tracks.length }),
      allowedMentions: NO_PINGS
    });
  } catch (error) {
    console.error("[collections] Error cloning collection:", error);
    return interaction.reply(failed());
  }
}

async function handleMerge(interaction: CachedChatInput, userId: string) {
  const source = interaction.options.getString("source", true);
  const target = interaction.options.getString("target", true);

  if (source === target) return interaction.reply(ephemeral(i18n.__("collections.merge.sameCollection")));

  const collection = await collectionService.merge(userId, source, target);
  if (!collection) return interaction.reply(ephemeral(i18n.__("collections.merge.notFound")));

  return interaction.reply({
    content: i18n.__mf("collections.merge.success", { source: nameOf(source), target: nameOf(target), count: collection.tracks.length }),
    allowedMentions: NO_PINGS
  });
}

async function handleAddCurrent(interaction: CachedChatInput, userId: string) {
  const name = interaction.options.getString("name", true);
  const queue = useQueue(interaction.guildId);

  if (!queue || !queue.currentTrack) return interaction.reply(ephemeral(i18n.__("collections.addcurrent.noTrack")));

  const collection = await collectionService.getByName(userId, name);
  if (!collection) return interaction.reply(ephemeral(i18n.__mf("collections.notFound", { name: nameOf(name) })));

  try {
    await collectionService.addTracks(userId, name, [queue.currentTrack]);
    return interaction.reply({
      content: i18n.__mf("collections.addcurrent.success", { track: safeText(queue.currentTrack.title, 100), name: nameOf(name) }),
      allowedMentions: NO_PINGS
    });
  } catch (error) {
    console.error("[collections] Error adding track:", error);
    return interaction.reply(failed());
  }
}

async function handleRemoveTrack(interaction: CachedChatInput, userId: string) {
  const name = interaction.options.getString("name", true);
  const position = interaction.options.getInteger("position", true);

  const collection = await collectionService.getByName(userId, name);
  if (!collection) return interaction.reply(ephemeral(i18n.__mf("collections.notFound", { name: nameOf(name) })));

  if (position < 1 || position > collection.tracks.length) {
    return interaction.reply(ephemeral(i18n.__mf("collections.removetrack.invalidPosition", { max: collection.tracks.length })));
  }

  const trackTitle = collection.tracks[position - 1].title;
  const result = await collectionService.removeTrack(userId, name, position - 1);
  if (!result) return interaction.reply(failed());

  return interaction.reply({
    content: i18n.__mf("collections.removetrack.success", { track: safeText(trackTitle, 100), name: nameOf(name) }),
    allowedMentions: NO_PINGS
  });
}
