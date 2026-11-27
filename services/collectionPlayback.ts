import { GuildQueue, QueryType, Track } from "discord-player";
import {
  ContainerBuilder,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  RepliableInteraction,
  User
} from "discord.js";
import type { ICollection } from "../models/Collection";
import type { BusCollectionTrack } from "../shared/types";
import { formatDuration, safeText } from "../utils/format";
import { i18n } from "../utils/i18n";
import { PlayRejection, playRejectionMessage, runPlay } from "../utils/playFlow";
import { dispatchPlay } from "./fleet/dispatcher";
import { hasPremiumFeature } from "../utils/premiumCheck";
import { DiscordPlayerService, isGuessGameQueue } from "./discordPlayer";
import { GuildSettingsService } from "./guildSettings";

/**
 * Loading a collection into the queue (/collections load and the Play / Add
 * to queue buttons on a collection).
 *
 * The first song goes through runPlay, the same pipeline as /play: voice and
 * permission checks, allowed channels, queue size, the presser as requester,
 * their audio quality. The rest join that queue as tracks that stream through
 * the player's yt-dlp hook when their turn comes (the way the player queues
 * YouTube playlists and Apple Music / Deezer albums), so a 300-song
 * collection doesn't need 300 searches up front.
 */
export type LoadMode = "next" | "end";

const ACCENT = 0xf8aa2a;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isSearchUrl(url: string): boolean {
  return /^ytsearch\d*:/i.test(url);
}

/** Links yt-dlp streams directly; anything else is matched on YouTube. */
function isDirectlyStreamable(url: string): boolean {
  const host = hostOf(url);
  return /(^|\.)youtube\.com$/.test(host) || host === "youtu.be" || /(^|\.)soundcloud\.com$/.test(host);
}

function searchText(track: BusCollectionTrack): string {
  const artist = track.author && track.author !== "Unknown" && track.author !== "Unknown Artist" ? track.author : "";
  return artist ? `${artist} - ${track.title}` : track.title;
}

/**
 * What yt-dlp streams for a stored track: YouTube and SoundCloud links as
 * they are, "ytsearch1:" queries as they are, and anything else (Spotify
 * links, old dead links) as a YouTube search for "Artist - Title".
 */
export function streamUrlFor(track: BusCollectionTrack): string {
  const url = (track.url || "").trim();
  if (isSearchUrl(url) || isDirectlyStreamable(url)) return url;
  return `ytsearch1:${searchText(track)} audio`;
}

/** The query handed to /play's pipeline for a stored track. */
export function playQueryFor(track: BusCollectionTrack): string {
  const url = streamUrlFor(track);
  if (!isSearchUrl(url)) return url;
  return url.replace(/^ytsearch\d*:/i, "").replace(/\s+audio$/i, "").trim() || track.title;
}

/** A queue track for a stored one, resolved by yt-dlp when it plays. */
function toQueueTrack(track: BusCollectionTrack, requestedBy: User): Track | null {
  const playerService = DiscordPlayerService.getInstance();
  const player = playerService.getPlayer();
  const extractor = playerService.getYouTubeExtractor();
  if (!player || !extractor) return null;

  const url = streamUrlFor(track);
  const queued = new Track(player, {
    title: track.title,
    description: "",
    author: track.author || "Unknown",
    url,
    thumbnail: track.thumbnail ?? "",
    duration: formatDuration((track.duration || 0) * 1000),
    views: 0,
    requestedBy,
    source: /(^|\.)soundcloud\.com$/.test(hostOf(url)) ? "soundcloud" : "youtube",
    queryType: isSearchUrl(url) ? QueryType.YOUTUBE_SEARCH : QueryType.YOUTUBE_VIDEO,
    raw: { title: track.title, author: track.author, url: track.url }
  });
  queued.extractor = extractor;
  return queued;
}

/**
 * Queue the songs after a collection's first one (already queued by the play
 * pipeline): right behind it when it was queued next into a running session,
 * else at the end. At most `room` songs. Returns how many were queued. Used
 * by the primary and by a fleet instance the collection was handed to.
 */
export function queueCollectionRest(
  queue: GuildQueue,
  tracks: BusCollectionTrack[],
  requestedBy: User,
  behindFirst: boolean,
  room: number
): number {
  const rest = tracks
    .slice(0, Math.max(0, room))
    .map((t) => toQueueTrack(t, requestedBy))
    .filter((t): t is Track => t !== null);
  if (rest.length === 0) return 0;
  // The play pipeline put the first song at the front; the rest follow it in order.
  if (behindFirst) rest.forEach((track, i) => queue.insertTrack(track, i + 1));
  else queue.addTrack(rest);
  return rest.length;
}

/** Songs to try before giving up on a collection whose first songs won't play. */
export const COLLECTION_FIRST_ATTEMPTS = 3;

async function respond(interaction: RepliableInteraction, content: string): Promise<void> {
  try {
    if (interaction.deferred || interaction.replied) await interaction.editReply({ content, components: [] });
    else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error("[collections] Could not reply:", (error as Error)?.message ?? error);
  }
}

/**
 * Why /play would refuse right now (same checks and messages as runPlay),
 * or null. Checked before the first attempt and after a failed one, so a
 * song that won't play is retried with the next one, but a voice or
 * permission problem is reported once.
 */
async function blockedReason(interaction: RepliableInteraction<"cached">): Promise<string | null> {
  const guild = interaction.guild;
  const voiceChannel = (interaction.member as GuildMember | null)?.voice?.channel;
  const playerService = DiscordPlayerService.getInstance();

  if (!voiceChannel) return `🔇 ${i18n.__("play.errorNotChannel")}`;
  if (!playerService.isInitialized()) return `⏳ ${i18n.__("play.initializing")}`;
  if (isGuessGameQueue(playerService.getQueue(guild.id))) return playRejectionMessage(new PlayRejection("gameRunning"), "");

  const existing = playerService.getQueue(guild.id);
  const live = existing && !existing.deleted ? existing : null;
  const botChannel = guild.members.me?.voice.channel;
  if (botChannel && botChannel.id !== voiceChannel.id && live?.currentTrack) {
    if (botChannel.members.filter((m) => !m.user.bot).size > 0) {
      return `🎧 ${i18n.__mf("play.botNotInChannel", { channel: `<#${botChannel.id}>` })}`;
    }
  }

  const me = guild.members.me;
  const perms = me ? voiceChannel.permissionsFor(me) : null;
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    return `🔒 ${i18n.__mf("play.cantJoin", { channel: `<#${voiceChannel.id}>` })}`;
  }

  const settingsService = GuildSettingsService.getInstance();
  if (!(await settingsService.isVoiceChannelAllowed(guild.id, voiceChannel.id))) {
    return `🚫 ${i18n.__("play.notAllowedChannel")}`;
  }
  const settings = await settingsService.getSettings(guild.id);
  if (live && live.tracks.size >= settings.maxQueueSize) {
    return `📜 ${i18n.__mf("play.queueFull", { max: settings.maxQueueSize })}`;
  }
  return null;
}

/**
 * Queue a collection for the user behind `interaction`. `next` puts it right
 * after the current song (or starts it when nothing plays); `end` appends.
 */
export async function loadCollection(
  interaction: RepliableInteraction<"cached">,
  collection: ICollection,
  mode: LoadMode,
  ephemeral: boolean
): Promise<void> {
  if (collection.tracks.length === 0) return respond(interaction, `📭 ${i18n.__("collections.load.empty")}`);

  const guildId = interaction.guildId;
  const settings = await GuildSettingsService.getInstance().getSettings(guildId);
  const longer = await hasPremiumFeature(interaction.user.id, "longer_songs").catch(() => false);
  const maxSeconds = longer ? 0 : settings.maxSongDuration ?? 0;
  const playable = collection.tracks.filter((t) => !maxSeconds || !t.duration || t.duration <= maxSeconds);
  if (playable.length === 0) {
    return respond(interaction, `⏱️ ${i18n.__mf("play.tooLong", { max: formatDuration(maxSeconds * 1000) })}`);
  }

  // Fleet: when another Bypass instance serves (or should serve) the member's
  // voice channel, the whole collection goes there in one hand-off, before the
  // checks below that only describe this instance.
  const handedOff = await dispatchPlay({
    interaction,
    query: playQueryFor(playable[0]),
    next: mode === "next",
    ephemeral,
    collection: { name: collection.name, tracks: playable.slice(1) }
  });
  if (handedOff) return;

  const blocked = await blockedReason(interaction);
  if (blocked) return respond(interaction, blocked);

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});
  }

  const playerService = DiscordPlayerService.getInstance();
  const before = playerService.getQueue(guildId);
  const wasActive = Boolean(before && !before.deleted && (before.currentTrack || before.node.isPlaying()));

  // First song through /play's pipeline; skip ones that can't be found.
  let result: Awaited<ReturnType<typeof runPlay>> = null;
  let index = 0;
  for (; index < Math.min(playable.length, COLLECTION_FIRST_ATTEMPTS); index++) {
    // Already routed above: play here.
    result = await runPlay({ interaction, query: playQueryFor(playable[index]), next: mode === "next", ephemeral, local: true });
    if (result) break;
    // runPlay already told the user why; only a song-specific failure is worth another try.
    if (await blockedReason(interaction)) return;
  }
  if (!result) return;

  const queue = result.queue;
  const room = Math.max(0, settings.maxQueueSize - queue.tracks.size);
  const added = 1 + queueCollectionRest(queue, playable.slice(index + 1), interaction.user, mode === "next" && wasActive, room);
  const skipped = collection.tracks.length - added;
  const lines = [i18n.__mf("collections.load.success", { name: safeText(collection.name, 80), count: added })];
  if (mode === "next" && wasActive) lines.push(`-# ${i18n.__("collections.load.queuedNext")}`);
  if (skipped > 0) lines.push(`-# ${i18n.__mf("collections.load.skipped", { count: skipped })}`);

  const container = new ContainerBuilder().setAccentColor(ACCENT).addTextDisplayComponents((t) => t.setContent(lines.join("\n")));
  try {
    // runPlay's confirmation is a Components V2 message; replace it with the summary.
    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } } as any);
  } catch {
    // The reply is still plain text (an earlier song failed and its error is showing).
    await interaction
      .editReply({ content: lines.join("\n"), components: [], allowedMentions: { parse: [] } })
      .catch((error) => console.error("[collections] Could not confirm load:", (error as Error)?.message ?? error));
  }
}
