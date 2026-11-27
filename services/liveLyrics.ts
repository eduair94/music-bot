import { randomBytes } from "crypto";
import { GuildQueue, Track } from "discord-player";
import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  DiscordAPIError,
  escapeMarkdown,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorSpacingSize
} from "discord.js";
import { isButton, registerComponentHandler } from "../structs/componentRouter";
import { safeText, truncate } from "../utils/format";
import { BotLocale, currentLocale, i18n, runWithLocale } from "../utils/i18n";
import { lineIndexAt, liveWindow, SyncedLine } from "../utils/lyricsQuery";
import { gate } from "../utils/permissions";
import { DiscordPlayerService, isGuessGameQueue } from "./discordPlayer";
import { findLyrics, LyricsResult } from "./lyrics";

/**
 * Live synced lyrics: one message per server that follows the player and
 * shows the previous line, the current one (bold heading) and the next two.
 *
 * Edits are rate-limited on purpose: the view only changes when the line
 * shown changes, at most every MIN_EDIT_GAP_MS. The view ends when the song
 * changes or stops, when its message is deleted, or after a few failed edits.
 * Messages are edited through the interaction token while it is valid
 * (works without channel permissions and for ephemeral replies), then with
 * the bot token.
 */

const ACCENT = 0xf8aa2a;
const V2 = MessageFlags.IsComponentsV2;
const NO_MENTIONS = { parse: [] as never[] };
const TICK_MS = 750;
const MIN_EDIT_GAP_MS = 2_500;
/** Show a line slightly early: the edit itself takes a moment to reach clients. */
const LEAD_MS = 500;
const MAX_FAILURES = 3;
/** Interaction tokens last 15 minutes; leave a margin. */
const TOKEN_TTL_MS = 14 * 60 * 1000;
/** A synced version this much longer/shorter than the track is probably a different cut. */
const DRIFT_HINT_SEC = 8;
const MAX_LIFETIME_MS = 2 * 60 * 60 * 1000;
const BLANK = String.fromCharCode(0x200b);

type LiveInteraction = ButtonInteraction | ChatInputCommandInteraction;
type StopReason = "ended" | "replaced" | "stopped" | "gone" | "failed" | "expired";

interface LiveView {
  id: string;
  guildId: string;
  trackId: string;
  title: string;
  artist: string;
  source: string;
  lines: SyncedLine[];
  driftHint: boolean;
  locale: BotLocale;
  starterId: string;
  interaction: LiveInteraction;
  /** "@original" for the interaction's own reply, else a follow-up message id. */
  messageRef: string;
  messageId: string;
  channelId: string;
  ephemeral: boolean;
  tokenAt: number;
  startedAt: number;
  lastKey: string | null;
  lastEditAt: number;
  failures: number;
  busy: boolean;
  stopped: boolean;
  timer: NodeJS.Timeout | null;
}

const views = new Map<string, LiveView>();

// ---------------------------------------------------------------- render

function lyricLine(text: string, max = 150): string {
  const trimmed = text.trim();
  if (!trimmed) return "♪";
  return escapeMarkdown(truncate(trimmed, max), { heading: true, bulletedList: true, numberedList: true, maskedLink: true });
}

function header(view: LiveView): string {
  return `-# 🔴 ${i18n.__("lyrics.liveTitle")}\n### 🎤 ${safeText(view.title, 80)} — ${safeText(view.artist, 60)}`;
}

function renderLive(view: LiveView, index: number, paused: boolean): ContainerBuilder {
  return runWithLocale(view.locale, () => {
    const { previous, current, next } = liveWindow(view.lines, index);
    const body: string[] = [];
    // Blank placeholders (zero-width space) keep the view the same height at the edges.
    body.push(previous !== null ? `-# ${lyricLine(previous)}` : `-# ${BLANK}`);
    body.push(`## ${current !== null ? lyricLine(current) : "♪"}`);
    for (const line of next) body.push(lyricLine(line));
    if (next.length === 0) body.push(BLANK);

    const footer = [i18n.__mf("lyricsCmd.source", { source: view.source })];
    if (paused) footer.unshift(`⏸ ${i18n.__("lyrics.livePaused")}`);
    if (view.driftHint) footer.push(i18n.__("lyrics.liveVersionHint"));

    return new ContainerBuilder()
      .setAccentColor(ACCENT)
      .addTextDisplayComponents((t) => t.setContent(header(view)))
      .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addTextDisplayComponents((t) => t.setContent(body.join("\n")))
      .addTextDisplayComponents((t) => t.setContent(`-# ${footer.join(" · ")}`))
      .addActionRowComponents((row) =>
        row.setComponents(
          new ButtonBuilder()
            .setCustomId(`lyrics:stop:${view.id}`)
            .setEmoji("⏹️")
            .setLabel(i18n.__("lyrics.liveStop"))
            .setStyle(ButtonStyle.Secondary)
        )
      );
  });
}

function renderEnded(view: LiveView, note: string): ContainerBuilder {
  return runWithLocale(view.locale, () =>
    new ContainerBuilder()
      .setAccentColor(ACCENT)
      .addTextDisplayComponents((t) => t.setContent(`### 🎤 ${safeText(view.title, 80)} — ${safeText(view.artist, 60)}\n-# ${note}`))
  );
}

function payloadOf(container: ContainerBuilder) {
  return { components: [container], flags: V2, allowedMentions: NO_MENTIONS } as const;
}

// ------------------------------------------------------------- lifecycle

function isGone(error: unknown): boolean {
  if (!(error instanceof DiscordAPIError)) return false;
  // Unknown Message, Unknown Channel, Unknown Webhook, Invalid Webhook Token
  return [10008, 10003, 10015, 50027].includes(Number(error.code));
}

async function edit(view: LiveView, container: ContainerBuilder): Promise<void> {
  const payload = payloadOf(container);
  if (Date.now() - view.tokenAt < TOKEN_TTL_MS) {
    await view.interaction.editReply({ ...payload, message: view.messageRef } as any);
    return;
  }
  if (view.ephemeral) throw new Error("interaction token expired");
  const channel = view.interaction.client.channels.cache.get(view.channelId);
  if (!channel || !channel.isTextBased()) throw new Error("channel unavailable");
  await channel.messages.edit(view.messageId, payload as any);
}

function stop(view: LiveView, reason: StopReason, by?: string): void {
  if (view.stopped) return;
  view.stopped = true;
  if (view.timer) clearInterval(view.timer);
  view.timer = null;
  if (views.get(view.guildId) === view) views.delete(view.guildId);
  // Not sent yet: "@original" would still point at the message the button is
  // on (the player panel). openLiveLyrics closes it once it exists.
  if (!view.messageId) return;

  if (reason === "ended" || reason === "replaced" || reason === "stopped") {
    const note = runWithLocale(view.locale, () =>
      reason === "replaced"
        ? i18n.__("lyrics.liveReplaced")
        : reason === "stopped" && by
          ? i18n.__mf("lyrics.liveStoppedBy", { user: `<@${by}>` })
          : i18n.__("lyrics.liveEnded")
    );
    void edit(view, renderEnded(view, note)).catch(() => undefined);
  }
}

async function tick(view: LiveView): Promise<void> {
  if (view.stopped || view.busy) return;
  const queue = DiscordPlayerService.getInstance().getQueue(view.guildId);
  const track = queue && !queue.deleted ? queue.currentTrack : null;
  if (!queue || !track || track.id !== view.trackId || isGuessGameQueue(queue)) return stop(view, "ended");
  if (Date.now() - view.startedAt > MAX_LIFETIME_MS) return stop(view, "ended");
  if (view.ephemeral && Date.now() - view.tokenAt >= TOKEN_TTL_MS) return stop(view, "expired");

  const position = queue.node.getTimestamp()?.current.value ?? 0;
  const paused = queue.node.isPaused();
  const index = lineIndexAt(view.lines, position + LEAD_MS);
  const key = `${index}|${paused ? 1 : 0}`;
  if (key === view.lastKey || Date.now() - view.lastEditAt < MIN_EDIT_GAP_MS) return;

  view.busy = true;
  try {
    await edit(view, renderLive(view, index, paused));
    view.lastKey = key;
    view.failures = 0;
  } catch (error) {
    if (isGone(error)) return stop(view, "gone");
    view.failures += 1;
    console.warn(`[LiveLyrics] Edit failed in ${view.guildId} (${view.failures}/${MAX_FAILURES}):`, (error as Error)?.message ?? error);
    if (view.failures >= MAX_FAILURES) stop(view, "failed");
  } finally {
    view.lastEditAt = Date.now();
    view.busy = false;
  }
}

/** Synced lyrics usable for a live view of `track`, or null. */
export function canGoLive(result: LyricsResult | null, track: Track | null | undefined): result is LyricsResult & { synced: SyncedLine[] } {
  return Boolean(result?.synced?.length && track && track.durationMS > 0);
}

export interface OpenLiveOptions {
  queue: GuildQueue;
  track: Track;
  result: LyricsResult & { synced: SyncedLine[] };
  /**
   * "reply": the interaction was deferred with deferReply; the view fills that reply.
   * "followUp": a new message. The interaction must have been acknowledged with
   * deferUpdate (a follow-up right after deferReply would edit the deferred reply).
   */
  via: "reply" | "followUp";
  ephemeral: boolean;
}

/**
 * Open the live view for the playing track. Replaces the server's previous
 * live view, if any. Throws when the message could not be sent.
 */
export async function openLiveLyrics(interaction: LiveInteraction, options: OpenLiveOptions): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) throw new Error("live lyrics need a server");
  const { queue, track, result } = options;

  const previous = views.get(guildId);
  if (previous) stop(previous, "replaced");

  const trackSec = Math.round(track.durationMS / 1000);
  const view: LiveView = {
    id: randomBytes(4).toString("hex"),
    guildId,
    trackId: track.id,
    title: result.title,
    artist: result.artist,
    source: result.syncedSource ?? result.source,
    lines: result.synced,
    driftHint: Boolean(result.syncedDurationSec && trackSec && Math.abs(result.syncedDurationSec - trackSec) > DRIFT_HINT_SEC),
    locale: currentLocale(),
    starterId: interaction.user.id,
    interaction,
    messageRef: "@original",
    messageId: "",
    channelId: interaction.channelId ?? "",
    ephemeral: options.ephemeral,
    tokenAt: interaction.createdTimestamp,
    startedAt: Date.now(),
    lastKey: null,
    lastEditAt: 0,
    failures: 0,
    busy: false,
    stopped: false,
    timer: null
  };
  views.set(guildId, view);

  const position = queue.node.getTimestamp()?.current.value ?? 0;
  const paused = queue.node.isPaused();
  const index = lineIndexAt(view.lines, position + LEAD_MS);
  const container = renderLive(view, index, paused);

  let message: Message;
  try {
    if (options.via === "followUp") {
      message = await interaction.followUp({
        ...payloadOf(container),
        flags: options.ephemeral ? V2 | MessageFlags.Ephemeral : V2
      } as any);
      view.messageRef = message.id;
    } else {
      message = await interaction.editReply(payloadOf(container) as any);
    }
  } catch (error) {
    view.stopped = true;
    if (views.get(guildId) === view) views.delete(guildId);
    throw error;
  }

  view.messageId = message.id;
  view.channelId = message.channelId;
  if (view.stopped) {
    // Replaced (or the game took over) while this one was being sent.
    void edit(view, renderEnded(view, i18n.__("lyrics.liveEnded"))).catch(() => undefined);
    return;
  }
  view.lastKey = `${index}|${paused ? 1 : 0}`;
  view.lastEditAt = Date.now();
  view.timer = setInterval(() => void tick(view), TICK_MS);
  view.timer.unref();
}

/** End the server's live view (e.g. the guess game took over the player). */
export function stopLiveLyrics(guildId: string): void {
  const view = views.get(guildId);
  if (view) stop(view, "ended");
}

export function hasLiveLyrics(guildId: string): boolean {
  return views.has(guildId);
}

// --------------------------------------------------------------- buttons

/** "Live" on a static /lyrics message: open the live view for what's playing now. */
async function handleLiveButton(interaction: ButtonInteraction): Promise<unknown> {
  const ephemeralFlag = MessageFlags.Ephemeral;
  if (!interaction.inCachedGuild()) {
    return interaction.reply({ content: `🎵 ${i18n.__("router.guildOnly")}`, flags: ephemeralFlag });
  }
  const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
  const track = queue && !queue.deleted ? queue.currentTrack : null;
  if (!queue || !track) {
    return interaction.reply({ content: `🔇 ${i18n.__("player.nothingPlaying")}`, flags: ephemeralFlag });
  }
  if (isGuessGameQueue(queue)) {
    return interaction.reply({ content: `🎮 ${i18n.__("lyrics.liveNotDuringGame")}`, flags: ephemeralFlag });
  }
  if (!(await gate(interaction, "lyrics_view"))) return;

  const ephemeral = interaction.message.flags.has(MessageFlags.Ephemeral);
  await interaction.deferReply(ephemeral ? { flags: ephemeralFlag } : {});
  const result = await findLyrics(track.title, track.author || "", { durationMs: track.durationMS, preferSynced: true });
  if (!canGoLive(result, track) || queue.currentTrack?.id !== track.id) {
    return interaction.editReply({ content: `🎤 ${i18n.__("lyrics.liveNoSync")}` });
  }
  return openLiveLyrics(interaction, { queue, track, result, via: "reply", ephemeral });
}

async function handleStopButton(interaction: ButtonInteraction, viewId: string): Promise<unknown> {
  const ephemeralFlag = MessageFlags.Ephemeral;
  const view = interaction.guildId ? views.get(interaction.guildId) : undefined;
  if (!view || view.id !== viewId) {
    return interaction.reply({ content: i18n.__("router.expired"), flags: ephemeralFlag });
  }
  const canManage = interaction.inCachedGuild() && interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);
  if (interaction.user.id !== view.starterId && !canManage) {
    return interaction.reply({ content: `🔒 ${i18n.__("lyrics.liveNoPermission")}`, flags: ephemeralFlag });
  }
  view.stopped = true;
  if (view.timer) clearInterval(view.timer);
  view.timer = null;
  views.delete(view.guildId);
  const note = runWithLocale(view.locale, () => i18n.__mf("lyrics.liveStoppedBy", { user: `<@${interaction.user.id}>` }));
  return interaction.update(payloadOf(renderEnded(view, note)) as any);
}

registerComponentHandler("lyrics", (interaction, args) => {
  if (!isButton(interaction)) return;
  if (args[0] === "live") return handleLiveButton(interaction);
  if (args[0] === "stop") return handleStopButton(interaction, args[1] ?? "");
  return interaction.reply({ content: i18n.__("router.expired"), flags: MessageFlags.Ephemeral });
});
