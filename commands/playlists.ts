import { QueryType, useQueue } from "discord-player";
import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  InteractionReplyOptions,
  MessageFlags,
  SlashCommandBuilder
} from "discord.js";
import { collectionService, MAX_COLLECTION_TRACKS } from "../services/collection";
import { ImportError, resolvePlaylist } from "../services/collectionImport";
import { loadCollection } from "../services/collectionPlayback";
import { buildCollectionList, buildCollectionView } from "../services/collectionView";
import { DatabaseService } from "../services/database";
import { DiscordPlayerService } from "../services/discordPlayer";
import { canManageServerPlaylists, serverOwnerKey } from "../services/serverPlaylists";
import { logAction } from "../utils/actionLog";
import { isHttpUrl, safeText, truncate } from "../utils/format";
import { descriptionLocalizations, i18n } from "../utils/i18n";

/**
 * /playlists — the server's shared playlists, run by its DJs
 * (services/serverPlaylists.ts). Everyone can list, view, play and copy
 * them; DJs and admins create, edit and delete.
 */

const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const NO_PINGS = { parse: [] as [] };

type Cached = ChatInputCommandInteraction<"cached">;

function described<T extends { setDescription(text: string): T; setDescriptionLocalizations(map: Record<string, string> | null): T }>(
  builder: T,
  key: string
): T {
  return builder.setDescription(i18n.__(key)).setDescriptionLocalizations(descriptionLocalizations(key) ?? null);
}

const ephemeral = (content: string): InteractionReplyOptions => ({ content, flags: EPHEMERAL, allowedMentions: NO_PINGS });
const failed = () => ephemeral(`⚠️ ${i18n.__("collections.error")}`);
const nameOf = (name: string) => safeText(name, 100);

/** Subcommands that change the server's playlists. */
const MANAGE = new Set(["create", "save", "add", "remove", "rename", "delete", "import"]);
/** Subcommands whose `name` is a new playlist (no suggestions). */
const NEW_NAME = new Set(["create", "import"]);

const nameOption = (key: string, autocomplete = true) => (opt: any) =>
  described(opt.setName("name"), key).setRequired(true).setMaxLength(100).setAutocomplete(autocomplete);

export default {
  data: new SlashCommandBuilder()
    .setName("playlists")
    .setDescription(i18n.__("playlists.description"))
    .setDescriptionLocalizations(descriptionLocalizations("playlists.description") ?? null)
    .addSubcommand((sub) => described(sub.setName("list"), "playlists.list.description"))
    .addSubcommand((sub) => described(sub.setName("view"), "playlists.view.description").addStringOption(nameOption("playlists.nameOption")))
    .addSubcommand((sub) =>
      described(sub.setName("play"), "playlists.play.description")
        .addStringOption(nameOption("playlists.nameOption"))
        .addBooleanOption((opt) => described(opt.setName("next"), "playlists.play.nextOption"))
    )
    .addSubcommand((sub) =>
      described(sub.setName("create"), "playlists.create.description")
        .addStringOption(nameOption("playlists.newNameOption", false))
        .addStringOption((opt) => described(opt.setName("description"), "collections.create.descriptionOption").setMaxLength(500))
    )
    .addSubcommand((sub) => described(sub.setName("save"), "playlists.save.description").addStringOption(nameOption("playlists.nameOption")))
    .addSubcommand((sub) =>
      described(sub.setName("add"), "playlists.add.description")
        .addStringOption(nameOption("playlists.nameOption"))
        .addStringOption((opt) => described(opt.setName("song"), "playlists.add.songOption").setMaxLength(300))
    )
    .addSubcommand((sub) =>
      described(sub.setName("remove"), "playlists.remove.description")
        .addStringOption(nameOption("playlists.nameOption"))
        .addIntegerOption((opt) => described(opt.setName("position"), "collections.removetrack.positionOption").setRequired(true).setMinValue(1))
    )
    .addSubcommand((sub) =>
      described(sub.setName("rename"), "playlists.rename.description")
        .addStringOption(nameOption("playlists.nameOption"))
        .addStringOption((opt) => described(opt.setName("new_name"), "collections.rename.newNameOption").setRequired(true).setMaxLength(100))
    )
    .addSubcommand((sub) => described(sub.setName("delete"), "playlists.delete.description").addStringOption(nameOption("playlists.nameOption")))
    .addSubcommand((sub) =>
      described(sub.setName("import"), "playlists.import.description")
        .addStringOption((opt) => described(opt.setName("url"), "collections.import.urlOption").setRequired(true).setMaxLength(500))
        .addStringOption((opt) => described(opt.setName("name"), "playlists.newNameOption").setMaxLength(100))
    )
    .addSubcommand((sub) =>
      described(sub.setName("copy"), "playlists.copy.description")
        .addStringOption(nameOption("playlists.nameOption"))
        .addStringOption((opt) => described(opt.setName("as"), "playlists.copy.asOption").setMaxLength(100))
    ),
  category: "playlists",
  cooldown: 3,

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    const sub = interaction.options.getSubcommand(false) ?? "";
    if (!interaction.guildId || focused.name !== "name" || NEW_NAME.has(sub) || !DatabaseService.getInstance().isReady()) {
      return interaction.respond([]);
    }
    const typed = String(focused.value ?? "").toLowerCase().trim();
    const summaries = await collectionService.listSummaries(serverOwnerKey(interaction.guildId));
    return interaction.respond(
      summaries
        .filter((c) => !typed || c.name.toLowerCase().includes(typed))
        .slice(0, 25)
        .map((c) => ({ name: truncate(`${c.name} · ${i18n.__mf("collections.trackCount", { count: c.count })}`, 100), value: c.name.slice(0, 100) }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;
    if (!DatabaseService.getInstance().isReady()) return interaction.reply(failed());
    const sub = interaction.options.getSubcommand();
    const owner = serverOwnerKey(interaction.guildId);

    if (MANAGE.has(sub) && !(await canManageServerPlaylists(interaction.member as GuildMember))) {
      return interaction.reply(ephemeral(`🔒 ${i18n.__("playlists.needDj")}`));
    }

    try {
      switch (sub) {
        case "list":
          return await handleList(interaction, owner);
        case "view":
          return await handleView(interaction, owner);
        case "play":
          return await handlePlay(interaction, owner);
        case "create":
          return await handleCreate(interaction, owner);
        case "save":
          return await handleSave(interaction, owner);
        case "add":
          return await handleAdd(interaction, owner);
        case "remove":
          return await handleRemove(interaction, owner);
        case "rename":
          return await handleRename(interaction, owner);
        case "delete":
          return await handleDelete(interaction, owner);
        case "import":
          return await handleImport(interaction, owner);
        case "copy":
          return await handleCopy(interaction, owner);
        default:
          return interaction.reply(failed());
      }
    } catch (error) {
      console.error(`[playlists] ${sub} failed:`, error);
      if (interaction.deferred || interaction.replied) return interaction.editReply({ content: `⚠️ ${i18n.__("collections.error")}`, components: [] });
      return interaction.reply(failed());
    }
  }
};

async function find(interaction: Cached, owner: string) {
  const name = interaction.options.getString("name", true).trim();
  const playlist = await collectionService.getByName(owner, name);
  if (!playlist) await interaction.reply(ephemeral(`📭 ${i18n.__mf("playlists.notFound", { name: nameOf(name) })}`));
  return playlist;
}

async function handleList(interaction: Cached, owner: string) {
  const summaries = await collectionService.listSummaries(owner);
  if (summaries.length === 0) return interaction.reply(ephemeral(i18n.__("playlists.list.empty")));
  return interaction.reply({
    components: [buildCollectionList(owner, summaries, i18n.__("playlists.list.title"))],
    flags: V2,
    allowedMentions: NO_PINGS
  } as any);
}

async function handleView(interaction: Cached, owner: string) {
  const playlist = await find(interaction, owner);
  if (!playlist) return;
  return interaction.reply({ components: [buildCollectionView(playlist, 0)], flags: V2, allowedMentions: NO_PINGS } as any);
}

async function handlePlay(interaction: Cached, owner: string) {
  const playlist = await find(interaction, owner);
  if (!playlist) return;
  return loadCollection(interaction, playlist, interaction.options.getBoolean("next") ? "next" : "end", false);
}

async function handleCreate(interaction: Cached, owner: string) {
  const name = interaction.options.getString("name", true).trim();
  if (!(await collectionService.canCreateCollection(owner))) return interaction.reply(ephemeral(i18n.__("playlists.limitReached")));
  if (await collectionService.getByName(owner, name)) {
    return interaction.reply(ephemeral(i18n.__mf("playlists.exists", { name: nameOf(name) })));
  }
  await collectionService.create(owner, name, interaction.options.getString("description") || undefined);
  await logAction(interaction.guild, interaction.user, "playlists", () => i18n.__mf("playlists.log.create", { name: name }));
  return interaction.reply({ content: `📁 ${i18n.__mf("playlists.created", { name: nameOf(name) })}`, allowedMentions: NO_PINGS });
}

async function handleSave(interaction: Cached, owner: string) {
  const name = interaction.options.getString("name", true).trim();
  const queue = useQueue(interaction.guildId);
  if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) return interaction.reply(ephemeral(i18n.__("collections.save.noQueue")));
  const existing = await collectionService.getByName(owner, name);
  if (!existing && !(await collectionService.canCreateCollection(owner))) return interaction.reply(ephemeral(i18n.__("playlists.limitReached")));
  const saved = await collectionService.saveQueue(owner, name, queue.tracks.toArray().slice(0, MAX_COLLECTION_TRACKS - 1), queue.currentTrack || undefined);
  await logAction(interaction.guild, interaction.user, "playlists", () => i18n.__mf("playlists.log.save", { name: name }));
  return interaction.reply({
    content: `💾 ${i18n.__mf("playlists.saved", { name: nameOf(name), count: saved.tracks.length })}`,
    allowedMentions: NO_PINGS
  });
}

async function handleAdd(interaction: Cached, owner: string) {
  const playlist = await find(interaction, owner);
  if (!playlist) return;
  if (playlist.tracks.length >= MAX_COLLECTION_TRACKS) return interaction.reply(ephemeral(i18n.__("playlists.full")));

  const query = interaction.options.getString("song")?.trim();
  let track = useQueue(interaction.guildId)?.currentTrack ?? null;
  if (query) {
    await interaction.deferReply();
    const player = DiscordPlayerService.getInstance().getPlayer();
    const result = player
      ? await player.search(query, { requestedBy: interaction.user, searchEngine: isHttpUrl(query) ? QueryType.AUTO : QueryType.YOUTUBE_SEARCH }).catch(() => null)
      : null;
    track = result?.tracks[0] ?? null;
    if (!track) return interaction.editReply({ content: `🔍 ${i18n.__mf("play.errorNoResults", { query: safeText(query, 100) })}` });
  } else if (!track) {
    return interaction.reply(ephemeral(i18n.__("playlists.add.nothing")));
  }

  await collectionService.addTracks(owner, playlist.name, [track]);
  const content = `➕ ${i18n.__mf("collections.addcurrent.success", { track: safeText(track.title, 100), name: nameOf(playlist.name) })}`;
  return interaction.deferred ? interaction.editReply({ content, allowedMentions: NO_PINGS }) : interaction.reply({ content, allowedMentions: NO_PINGS });
}

async function handleRemove(interaction: Cached, owner: string) {
  const playlist = await find(interaction, owner);
  if (!playlist) return;
  const position = interaction.options.getInteger("position", true);
  if (position < 1 || position > playlist.tracks.length) {
    return interaction.reply(ephemeral(i18n.__mf("collections.removetrack.invalidPosition", { max: playlist.tracks.length })));
  }
  const title = playlist.tracks[position - 1].title;
  if (!(await collectionService.removeTrack(owner, playlist.name, position - 1))) return interaction.reply(failed());
  return interaction.reply({
    content: `➖ ${i18n.__mf("collections.removetrack.success", { track: safeText(title, 100), name: nameOf(playlist.name) })}`,
    allowedMentions: NO_PINGS
  });
}

async function handleRename(interaction: Cached, owner: string) {
  const playlist = await find(interaction, owner);
  if (!playlist) return;
  const next = interaction.options.getString("new_name", true).trim();
  if (await collectionService.getByName(owner, next)) return interaction.reply(ephemeral(i18n.__mf("playlists.exists", { name: nameOf(next) })));
  if (!(await collectionService.rename(owner, playlist.name, next))) return interaction.reply(failed());
  return interaction.reply({ content: `✏️ ${i18n.__mf("playlists.renamed", { old: nameOf(playlist.name), name: nameOf(next) })}`, allowedMentions: NO_PINGS });
}

async function handleDelete(interaction: Cached, owner: string) {
  const playlist = await find(interaction, owner);
  if (!playlist) return;
  if (!(await collectionService.delete(owner, playlist.name))) return interaction.reply(failed());
  await logAction(interaction.guild, interaction.user, "playlists", () => i18n.__mf("playlists.log.delete", { name: playlist.name }));
  return interaction.reply({ content: `🗑️ ${i18n.__mf("playlists.deleted", { name: nameOf(playlist.name) })}`, allowedMentions: NO_PINGS });
}

async function handleImport(interaction: Cached, owner: string) {
  const url = interaction.options.getString("url", true).trim();
  const requested = interaction.options.getString("name")?.trim() || null;
  if (!isHttpUrl(url)) return interaction.reply(ephemeral(`🔗 ${i18n.__("collections.import.invalidUrl")}`));
  if (!(await collectionService.canCreateCollection(owner))) return interaction.reply(ephemeral(i18n.__("playlists.limitReached")));
  if (requested && (await collectionService.getByName(owner, requested))) {
    return interaction.reply(ephemeral(i18n.__mf("playlists.exists", { name: nameOf(requested) })));
  }
  await interaction.deferReply();
  let imported;
  try {
    imported = await resolvePlaylist(url, interaction.user, MAX_COLLECTION_TRACKS);
  } catch (error) {
    if (error instanceof ImportError && error.code === "notReady") return interaction.editReply({ content: `⏳ ${i18n.__("play.initializing")}` });
    if (error instanceof ImportError && error.code === "invalidUrl") return interaction.editReply({ content: `🔗 ${i18n.__("collections.import.invalidUrl")}` });
    if (!(error instanceof ImportError)) console.error("[playlists] Import failed:", error);
    return interaction.editReply({ content: `❌ ${i18n.__("collections.import.failed")}` });
  }
  if (imported.tracks.length === 0) return interaction.editReply({ content: `❌ ${i18n.__("collections.import.failed")}` });
  const name = truncate(requested || imported.title?.trim() || "Imported", 100);
  if (!requested && (await collectionService.getByName(owner, name))) {
    return interaction.editReply({ content: i18n.__mf("playlists.exists", { name: nameOf(name) }), allowedMentions: NO_PINGS });
  }
  const { collection } = await collectionService.createFromTracks(owner, name, imported.tracks, url);
  await logAction(interaction.guild, interaction.user, "playlists", () => i18n.__mf("playlists.log.import", { name: name }));
  return interaction.editReply({
    components: [buildCollectionView(collection, 0, `📥 ${i18n.__mf("playlists.imported", { name: nameOf(name), count: collection.tracks.length })}`)],
    flags: V2,
    allowedMentions: NO_PINGS
  } as any);
}

async function handleCopy(interaction: Cached, owner: string) {
  const playlist = await find(interaction, owner);
  if (!playlist) return;
  const target = (interaction.options.getString("as")?.trim() || playlist.name).slice(0, 100);
  const userId = interaction.user.id;
  if (!(await collectionService.canCreateCollection(userId))) return interaction.reply(ephemeral(i18n.__("collections.create.limitReached")));
  if (await collectionService.getByName(userId, target)) {
    return interaction.reply(ephemeral(i18n.__mf("collections.create.exists", { name: nameOf(target) })));
  }
  const tracks = playlist.tracks.map(({ title, author, url, duration, thumbnail }) => ({ title, author, url, duration, thumbnail }));
  await collectionService.createFromTracks(userId, target, tracks, playlist.sourceUrl);
  return interaction.reply(ephemeral(`📋 ${i18n.__mf("playlists.copied", { name: nameOf(target), count: tracks.length })}`));
}
