import { AttachmentExtractor } from "@discord-player/extractor";
import { randomBytes } from "crypto";
import { GuildQueue, QueryType, QueueRepeatMode, Track } from "discord-player";
import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  ContainerBuilder,
  Events,
  GuildMember,
  GuildTextBasedChannel,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorSpacingSize,
  TextChannel
} from "discord.js";
import { mention } from "../structs/commandRegistry";
import { isButton, registerComponentHandler } from "../structs/componentRouter";
import { safeText, truncate } from "../utils/format";
import { localeForGuild } from "../utils/guildLocale";
import { BotLocale, i18n, runWithLocale } from "../utils/i18n";
import { ensureAutoplayNext } from "./autoplay";
import { DiscordPlayerService, QueueMetadata } from "./discordPlayer";
import { servedByOtherInstance } from "./fleet/dispatcher";
import { buildChoices, CHOICES_PER_ROUND, displayTitle, pickRoundTracks, PreviewTrack, rankScores, scoreFor, shuffle } from "./guessLogic";
import { GuildSettingsService } from "./guildSettings";
import { stopLiveLyrics } from "./liveLyrics";
import { PlayerPanelService } from "./playerPanel";
import { freshPreviewUrl, GenreKey, loadPreviewPool } from "./previewSource";

/**
 * Guess the song: each round plays a 30-second preview in the voice channel
 * and posts four answer buttons. The first correct answer scores (more when
 * faster), a wrong answer locks that player out of the round, and the answer
 * is revealed after ROUND_MS or on the first correct answer.
 *
 * The game owns the server's queue while it runs and marks it with
 * `QueueMetadata.guessGame`, so the player panel, voice status, autoplay,
 * stats and dashboard stay silent and nothing reveals the song early. The
 * preview tracks themselves carry a neutral title ("Guess the song · round 2").
 *
 * State is in memory: after a restart, old buttons answer "this game is over".
 */

export const ROUND_MS = 25_000;
const REVEAL_MS = 7_000;
const INTRO_MS = 5_000;
const FINAL_DELAY_MS = 3_000;
const START_TIMEOUT_MS = 15_000;
const EMPTY_GRACE_MS = 6_000;
const MAX_PLAY_ATTEMPTS = 3;
export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 15;
export const DEFAULT_ROUNDS = 5;

const ACCENT = 0xf8aa2a;
const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const NO_MENTIONS = { parse: [] as never[] };
const NUMBER_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];
const MEDALS = ["🥇", "🥈", "🥉"];

type EndReason = "finished" | "stopped" | "empty" | "disconnected" | "music" | "error";

interface RoundState {
  index: number;
  track: PreviewTrack;
  options: PreviewTrack[];
  correctIndex: number;
  startedAt: number;
  closesAt: number;
  lockedOut: Set<string>;
  resolved: boolean;
  message: Message | null;
  timer: NodeJS.Timeout | null;
}

/** Queue options the game overrides on a borrowed queue, restored afterwards. */
interface SavedOptions {
  leaveOnEmpty: boolean;
  leaveOnEnd: boolean;
  leaveOnStop: boolean;
  pauseOnEmpty: boolean;
  disableHistory: boolean;
  disableFallbackStream: boolean;
}

/** Loop mode and audio filters of a borrowed (24/7) queue, put back after the game. */
interface SavedPlayback {
  repeatMode: QueueRepeatMode;
  filters: string[];
}

interface Game {
  id: string;
  guildId: string;
  textChannel: GuildTextBasedChannel;
  voiceChannelId: string;
  starterId: string;
  genre: GenreKey;
  totalRounds: number;
  pool: PreviewTrack[];
  picks: PreviewTrack[];
  used: Set<string>;
  scores: Map<string, { points: number; correct: number }>;
  round: RoundState | null;
  locale: BotLocale;
  queue: GuildQueue;
  /** Options to put back on a queue the game borrowed; null when the game created the queue. */
  saved: SavedOptions | null;
  savedPlayback: SavedPlayback | null;
  introMessage: Message | null;
  timers: Set<NodeJS.Timeout>;
  emptyTimer: NodeJS.Timeout | null;
  ended: boolean;
}

const GAME_OPTIONS: SavedOptions = {
  leaveOnEmpty: false,
  leaveOnEnd: false,
  leaveOnStop: false,
  pauseOnEmpty: false,
  disableHistory: true,
  // Never let discord-player "fall back" to a YouTube search for a preview
  // titled "Guess the song": that would play some random video.
  disableFallbackStream: true
};

const games = new Map<string, Game>(); // by guild
const byId = new Map<string, Game>(); // by game id (button custom ids)
const starting = new Set<string>();

export function isGuessGameRunning(guildId: string): boolean {
  return games.has(guildId) || starting.has(guildId);
}

function isGameTrack(track: Track | null | undefined): boolean {
  return Boolean((track?.metadata as { guessGame?: string } | null | undefined)?.guessGame);
}

export function genreLabel(genre: GenreKey): string {
  return i18n.__(`guess.genre.${genre}`);
}

// ---------------------------------------------------------------- render

function stopButton(game: Game): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(`guess:${game.id}:stop`)
    .setEmoji("⏹️")
    .setLabel(i18n.__("guess.stopButton"))
    .setStyle(ButtonStyle.Danger);
}

function optionLabel(track: PreviewTrack): string {
  return truncate(`${displayTitle(track.title)} — ${track.artist}`, 80);
}

function scoreLines(game: Game, limit: number): string[] {
  return rankScores(game.scores)
    .slice(0, limit)
    .map((entry, i) =>
      `${MEDALS[i] ?? `\`${i + 1}.\``} ${i18n.__mf("guess.scoreLine", { user: `<@${entry.userId}>`, points: entry.points, correct: entry.correct })}`
    );
}

function renderIntro(game: Game, over = false): ContainerBuilder {
  return runWithLocale(game.locale, () => {
    const container = new ContainerBuilder().setAccentColor(ACCENT).addTextDisplayComponents((t) =>
      t.setContent(
        [
          `### 🎮 ${i18n.__("guess.title")}`,
          `**${i18n.__mf("guess.introMeta", { rounds: game.totalRounds, genre: genreLabel(game.genre) })}**`,
          i18n.__mf("guess.introBody", { channel: `<#${game.voiceChannelId}>` }),
          `-# ${over ? i18n.__("guess.introOver") : i18n.__("guess.introStarting")}`
        ].join("\n")
      )
    );
    if (!over) container.addActionRowComponents((row) => row.setComponents(stopButton(game)));
    return container;
  });
}

function choiceButtons(game: Game, round: RoundState, revealed: boolean): ButtonBuilder[] {
  return round.options.map((option, i) => {
    const button = new ButtonBuilder()
      .setCustomId(`guess:${game.id}:${round.index}:${i}`)
      .setEmoji(NUMBER_EMOJI[i] ?? "🎵")
      .setLabel(optionLabel(option))
      .setStyle(revealed && i === round.correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary);
    if (revealed) button.setDisabled(true);
    return button;
  });
}

function renderRound(game: Game, round: RoundState): ContainerBuilder {
  return runWithLocale(game.locale, () =>
    new ContainerBuilder()
      .setAccentColor(ACCENT)
      .addTextDisplayComponents((t) =>
        t.setContent(
          [
            `### 🎧 ${i18n.__mf("guess.roundTitle", { round: round.index, total: game.totalRounds })}`,
            `**${i18n.__("guess.roundPrompt")}**`,
            `-# ${i18n.__mf("guess.roundCloses", { time: `<t:${Math.ceil(round.closesAt / 1000)}:R>` })} · ${i18n.__("guess.roundRules")}`
          ].join("\n")
        )
      )
      .addActionRowComponents((row) => row.setComponents(choiceButtons(game, round, false)))
      .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
      .addActionRowComponents((row) => row.setComponents(stopButton(game)))
  );
}

interface Winner {
  userId: string;
  elapsedMs: number;
  points: number;
}

function renderReveal(game: Game, round: RoundState, winner: Winner | null, stopped = false): ContainerBuilder {
  return runWithLocale(game.locale, () => {
    const outcome = winner
      ? `✅ ${i18n.__mf("guess.correctBy", { user: `<@${winner.userId}>`, seconds: (winner.elapsedMs / 1000).toFixed(1), points: winner.points })}`
      : stopped
        ? `⏹️ ${i18n.__("guess.roundStopped")}`
        : `⏰ ${i18n.__("guess.timeUp")}`;
    const answer = i18n.__mf("guess.answerWas", {
      title: safeText(round.track.title, 100),
      artist: safeText(round.track.artist, 80)
    });
    const container = new ContainerBuilder()
      .setAccentColor(winner ? 0x57f287 : ACCENT)
      .addTextDisplayComponents((t) =>
        t.setContent([`### 🎧 ${i18n.__mf("guess.roundTitle", { round: round.index, total: game.totalRounds })}`, outcome, answer].join("\n"))
      )
      .addActionRowComponents((row) => row.setComponents(choiceButtons(game, round, true)));

    if (!stopped) {
      const scores = scoreLines(game, 5);
      const footer = round.index >= game.totalRounds ? i18n.__("guess.finalSoon") : i18n.__("guess.nextSoon");
      container
        .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents((t) =>
          t.setContent([`**${i18n.__("guess.scores")}**`, ...(scores.length ? scores : [i18n.__("guess.noScores")]), `-# ${footer}`].join("\n"))
        );
    }
    return container;
  });
}

function endNote(reason: EndReason, by?: string): string | null {
  switch (reason) {
    case "stopped":
      return by ? i18n.__mf("guess.stoppedBy", { user: `<@${by}>` }) : i18n.__("guess.stoppedPlain");
    case "empty":
      return i18n.__("guess.endedEmpty");
    case "disconnected":
      return i18n.__("guess.endedDisconnected");
    case "music":
      return i18n.__("guess.endedMusic");
    case "error":
      return i18n.__("guess.endedError");
    default:
      return null;
  }
}

function renderFinal(game: Game, reason: EndReason, by?: string): ContainerBuilder {
  return runWithLocale(game.locale, () => {
    const ranked = rankScores(game.scores);
    const lines = [`### 🏆 ${i18n.__("guess.finalTitle")}`];
    const note = endNote(reason, by);
    if (note) lines.push(`-# ${note}`);
    const scores = scoreLines(game, 10);
    if (scores.length) lines.push("", ...scores, "");
    if (ranked[0]) {
      lines.push(`**${i18n.__mf("guess.winner", { user: `<@${ranked[0].userId}>`, points: ranked[0].points })}**`);
    } else {
      lines.push(i18n.__("guess.noWinner"));
    }
    lines.push(`-# ${i18n.__mf("guess.playAgain", { command: mention("guess", "start") })}`);
    return new ContainerBuilder().setAccentColor(ACCENT).addTextDisplayComponents((t) => t.setContent(lines.join("\n")));
  });
}

// --------------------------------------------------------------- helpers

function schedule(game: Game, task: () => unknown, ms: number): void {
  const timer = setTimeout(() => {
    game.timers.delete(timer);
    if (game.ended) return;
    Promise.resolve()
      .then(task)
      .catch((error) => console.error("[GuessGame] Step failed:", error));
  }, ms);
  game.timers.add(timer);
}

function humansInVoice(game: Game): number {
  const channelId = game.queue.channel?.id ?? game.voiceChannelId;
  const channel = game.textChannel.guild.channels.cache.get(channelId);
  if (!channel || !channel.isVoiceBased()) return 0;
  return channel.members.filter((m) => !m.user.bot).size;
}

function canStop(member: GuildMember, game: Game): boolean {
  return member.id === game.starterId || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

function snapshotOptions(queue: GuildQueue): SavedOptions {
  const options = queue.options as any;
  return {
    leaveOnEmpty: Boolean(options.leaveOnEmpty),
    leaveOnEnd: Boolean(options.leaveOnEnd),
    leaveOnStop: Boolean(options.leaveOnStop),
    pauseOnEmpty: Boolean(options.pauseOnEmpty),
    disableHistory: Boolean(options.disableHistory),
    disableFallbackStream: Boolean(options.disableFallbackStream)
  };
}

function buildPreviewTrack(game: Game, round: number, url: string): Track | null {
  const player = DiscordPlayerService.getInstance().getPlayer();
  if (!player) return null;
  const track = new Track(player, {
    title: i18n.t(game.locale, "guess.trackTitle", { round }),
    description: "",
    author: i18n.t(game.locale, "guess.title"),
    url,
    thumbnail: "",
    duration: "0:30",
    views: 0,
    requestedBy: null,
    source: "arbitrary",
    queryType: QueryType.ARBITRARY,
    engine: url,
    // AttachmentExtractor streams `raw.engine` straight into FFmpeg.
    raw: { engine: url, isFile: false, source: "arbitrary" }
  });
  track.extractor = player.extractors.get(AttachmentExtractor.identifier) ?? null;
  track.setMetadata({ guessGame: game.id });
  return track;
}

/** Start `track` now, replacing the previous preview. */
function startTrack(queue: GuildQueue, track: Track): Promise<unknown> {
  if (queue.currentTrack && queue.dispatcher) {
    queue.insertTrack(track, 0);
    if (queue.node.skip()) return Promise.resolve();
    queue.removeTrack(track);
  }
  return queue.node.play(track, { queue: false });
}

/** Play a preview and resolve once audio actually starts (false on failure). */
function playPreview(game: Game, round: number, url: string): Promise<boolean> {
  const player = DiscordPlayerService.getInstance().getPlayer();
  const track = buildPreviewTrack(game, round, url);
  if (!player || !track || game.queue.deleted) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      player.events.off("playerStart", onStart);
      player.events.off("playerError", onError);
      player.events.off("playerSkip", onFail);
      player.events.off("playerFinish", onFail);
      resolve(ok);
    };
    const mine = (queue: GuildQueue, t: Track | undefined) => queue.guild.id === game.guildId && t?.id === track.id;
    const onStart = (queue: GuildQueue, t: Track) => mine(queue, t) && finish(true);
    const onError = (queue: GuildQueue, _error: Error, t: Track) => mine(queue, t) && finish(false);
    const onFail = (queue: GuildQueue, t: Track) => mine(queue, t) && finish(false);
    const timeout = setTimeout(() => finish(false), START_TIMEOUT_MS);
    player.events.on("playerStart", onStart);
    player.events.on("playerError", onError);
    player.events.on("playerSkip", onFail);
    player.events.on("playerFinish", onFail);
    startTrack(game.queue, track).catch((error) => {
      console.warn("[GuessGame] Could not start preview:", (error as Error)?.message ?? error);
      finish(false);
    });
  });
}

// ------------------------------------------------------------------ flow

async function startRound(game: Game, n: number): Promise<void> {
  if (game.ended) return;
  let track: PreviewTrack | null = game.picks[n - 1] ?? null;
  let started = false;
  for (let attempt = 0; attempt < MAX_PLAY_ATTEMPTS && !game.ended; attempt++) {
    // A preview that won't play is swapped for an unused song from the pool.
    track ??= game.pool.find((t) => !game.used.has(t.id) && !game.picks.includes(t)) ?? null;
    if (!track) break;
    game.used.add(track.id);
    game.picks[n - 1] = track;
    const url = await freshPreviewUrl(track);
    if (game.ended) return;
    started = await playPreview(game, n, url);
    if (started) break;
    console.warn(`[GuessGame] Preview ${track.id} did not play in ${game.guildId} (attempt ${attempt + 1})`);
    track = null;
  }
  if (game.ended) return;
  if (!started || !track) return endGame(game, "error");

  const avoid = new Set(game.picks.slice(n).map((t) => t.id));
  const { options, correctIndex } = buildChoices(track, game.pool, Math.random, avoid);
  const now = Date.now();
  const round: RoundState = {
    index: n,
    track,
    options,
    correctIndex,
    startedAt: now,
    closesAt: now + ROUND_MS,
    lockedOut: new Set(),
    resolved: false,
    message: null,
    timer: null
  };
  game.round = round;

  try {
    round.message = await game.textChannel.send({ components: [renderRound(game, round)], flags: V2, allowedMentions: NO_MENTIONS });
  } catch (error) {
    console.warn("[GuessGame] Could not post the round:", (error as Error)?.message ?? error);
    return endGame(game, "error");
  }
  if (game.ended) return;
  round.timer = setTimeout(() => void revealRound(game, round).catch(() => undefined), Math.max(1000, round.closesAt - Date.now()));
}

function scheduleNext(game: Game, round: RoundState): void {
  if (round.index >= game.totalRounds) schedule(game, () => endGame(game, "finished"), FINAL_DELAY_MS);
  else schedule(game, () => startRound(game, round.index + 1), REVEAL_MS);
}

/** Nobody got it (time up, or everyone in voice answered wrong). */
async function revealRound(game: Game, round: RoundState): Promise<void> {
  if (game.ended || round.resolved) return;
  round.resolved = true;
  if (round.timer) clearTimeout(round.timer);
  scheduleNext(game, round);
  await round.message
    ?.edit({ components: [renderReveal(game, round, null)], flags: V2, allowedMentions: NO_MENTIONS })
    .catch((error) => console.warn("[GuessGame] Could not reveal:", (error as Error)?.message ?? error));
}

/** Give the queue back: leave, or hand it to 24/7 / music queued meanwhile. */
async function releaseQueue(game: Game): Promise<void> {
  const queue = game.queue;
  if (queue.deleted) return;
  const metadata = (queue.metadata || {}) as QueueMetadata;
  const current = queue.currentTrack;
  const userPlaying = Boolean(current && !isGameTrack(current));
  const userQueued = queue.tracks.toArray().filter((t) => !isGameTrack(t));

  if (!metadata.stay247 && !userPlaying && userQueued.length === 0) {
    queue.delete();
    return;
  }

  for (const t of queue.tracks.toArray()) if (isGameTrack(t)) queue.removeTrack(t);
  queue.history.tracks.store = queue.history.tracks.store.filter((t) => !isGameTrack(t));
  metadata.guessGame = false;
  queue.metadata = metadata;
  if (game.saved) Object.assign(queue.options as any, game.saved);
  if (game.savedPlayback) {
    queue.setRepeatMode(game.savedPlayback.repeatMode);
    if (game.savedPlayback.filters.length) await queue.filters.ffmpeg.setFilters(game.savedPlayback.filters).catch(() => undefined);
  }
  if (!game.saved) {
    Object.assign(queue.options as any, { disableHistory: false, disableFallbackStream: false });
    await DiscordPlayerService.getInstance().applyServerOptions(queue);
  }

  if (userPlaying) {
    // Music took over mid-game: show the panel the flag suppressed.
    void PlayerPanelService.getInstance().announce(queue);
    void ensureAutoplayNext(queue);
  } else if (current && isGameTrack(current)) {
    if (userQueued.length) queue.node.skip();
    else queue.node.stop();
  } else if (userQueued.length && !queue.node.isPlaying()) {
    await queue.node.play().catch(() => undefined);
  }
}

async function endGame(game: Game, reason: EndReason, by?: string): Promise<void> {
  if (game.ended) return;
  game.ended = true;
  for (const timer of game.timers) clearTimeout(timer);
  game.timers.clear();
  if (game.emptyTimer) clearTimeout(game.emptyTimer);
  if (games.get(game.guildId) === game) games.delete(game.guildId);
  byId.delete(game.id);
  console.log(`[GuessGame] Game ${game.id} in ${game.guildId} ended (${reason}) after ${game.round?.index ?? 0}/${game.totalRounds} rounds`);

  // The round in progress (if any) shows its answer and loses its buttons.
  const round = game.round;
  if (round?.timer) clearTimeout(round.timer);
  let pendingReveal: Promise<unknown> | undefined;
  if (round && !round.resolved) {
    round.resolved = true;
    pendingReveal = round.message
      ?.edit({ components: [renderReveal(game, round, null, true)], flags: V2, allowedMentions: NO_MENTIONS })
      .catch(() => undefined);
  }

  await releaseQueue(game).catch((error) => console.warn("[GuessGame] Could not release the queue:", error));
  await pendingReveal;
  await game.textChannel
    .send({ components: [renderFinal(game, reason, by)], flags: V2, allowedMentions: NO_MENTIONS })
    .catch((error) => console.warn("[GuessGame] Could not post final scores:", (error as Error)?.message ?? error));
  await game.introMessage?.edit({ components: [renderIntro(game, true)], flags: V2, allowedMentions: NO_MENTIONS }).catch(() => undefined);
}

// ------------------------------------------------------------- listeners

let listening = false;

function checkVoice(game: Game): void {
  if (humansInVoice(game) > 0) {
    if (game.emptyTimer) clearTimeout(game.emptyTimer);
    game.emptyTimer = null;
    return;
  }
  if (game.emptyTimer) return;
  game.emptyTimer = setTimeout(() => {
    game.emptyTimer = null;
    if (!game.ended && humansInVoice(game) === 0) void endGame(game, "empty");
  }, EMPTY_GRACE_MS);
}

function ensureListeners(client: Client): void {
  if (listening) return;
  const player = DiscordPlayerService.getInstance().getPlayer();
  if (!player) return;
  listening = true;

  player.events.on("playerStart", (queue, track) => {
    const game = games.get(queue.guild.id);
    // Someone queued music on top of the game (e.g. /play): the music wins.
    if (game && !game.ended && game.queue === queue && !isGameTrack(track)) void endGame(game, "music");
  });
  const onGone = (queue: GuildQueue) => {
    const game = games.get(queue.guild.id);
    if (game && !game.ended && game.queue === queue) void endGame(game, "disconnected");
  };
  player.events.on("queueDelete", onGone);
  player.events.on("disconnect", onGone);

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const game = games.get(newState.guild.id);
    if (!game || game.ended) return;
    const channelId = game.queue.channel?.id ?? game.voiceChannelId;
    if (oldState.channelId === channelId || newState.channelId === channelId || newState.id === client.user?.id) checkVoice(game);
  });
}

// --------------------------------------------------------------- commands

/** /guess start */
export async function startGame(interaction: ChatInputCommandInteraction<"cached">, rounds: number, genre: GenreKey): Promise<unknown> {
  const guild = interaction.guild;
  const voice = interaction.member.voice.channel;
  if (!voice) return interaction.reply({ content: `🔇 ${i18n.__("guess.notInVoice")}`, flags: EPHEMERAL });
  if (isGuessGameRunning(guild.id)) return interaction.reply({ content: `🎮 ${i18n.__("guess.alreadyRunning")}`, flags: EPHEMERAL });
  // Another Bypass instance plays music in this channel: the game would talk over it.
  const servedBy = await servedByOtherInstance(interaction);
  if (servedBy) return interaction.reply({ content: servedBy, flags: EPHEMERAL });

  const service = DiscordPlayerService.getInstance();
  const player = service.getPlayer();
  if (!player) return interaction.reply({ content: `⚠️ ${i18n.__("guess.connectFailed")}`, flags: EPHEMERAL });

  let borrowed = service.getQueue(guild.id);
  if (borrowed?.deleted) borrowed = null;
  if (borrowed && (borrowed.currentTrack || borrowed.node.isPlaying())) {
    return interaction.reply({ content: `🎶 ${i18n.__("guess.musicPlaying")}`, flags: EPHEMERAL });
  }
  const me = guild.members.me;
  const botChannelId = me?.voice.channelId ?? null;
  const borrowedMeta = borrowed ? ((borrowed.metadata || {}) as QueueMetadata) : null;
  if (borrowedMeta?.stay247 && botChannelId && botChannelId !== voice.id) {
    return interaction.reply({ content: `🌙 ${i18n.__mf("guess.otherChannel", { channel: `<#${botChannelId}>` })}`, flags: EPHEMERAL });
  }
  const voicePerms = me ? voice.permissionsFor(me) : null;
  if (!voicePerms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]) || (botChannelId !== voice.id && !voice.joinable)) {
    return interaction.reply({ content: `🔒 ${i18n.__("guess.noVoicePermission")}`, flags: EPHEMERAL });
  }
  const text = interaction.channel;
  const textPerms = text && me ? text.permissionsFor(me) : null;
  const sendPerm = text?.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages;
  if (!text || !textPerms?.has([PermissionFlagsBits.ViewChannel, sendPerm])) {
    return interaction.reply({ content: `🔒 ${i18n.__("guess.noChannelAccess")}`, flags: EPHEMERAL });
  }

  starting.add(guild.id);
  try {
    await interaction.deferReply();
    const pool = shuffle(await loadPreviewPool(genre));
    if (pool.length < CHOICES_PER_ROUND) {
      return interaction.editReply({ content: `😕 ${i18n.__("guess.noTracks")}` });
    }
    const totalRounds = Math.min(rounds, pool.length);

    // Only a 24/7 queue is borrowed. Any other idle queue is replaced: after
    // music ends naturally discord-player arms a leave timer it doesn't track
    // in queue.timeouts, which would disconnect mid-game whatever the options
    // say; it would also carry its loop mode and audio filters into the game.
    if (borrowed && !borrowedMeta?.stay247) {
      borrowed.delete();
      borrowed = null;
    }

    let queue: GuildQueue;
    let saved: SavedOptions | null = null;
    let savedPlayback: SavedPlayback | null = null;
    if (borrowed && !borrowed.deleted) {
      queue = borrowed;
      saved = snapshotOptions(queue);
      savedPlayback = { repeatMode: queue.repeatMode, filters: [...queue.filters.ffmpeg.getFiltersEnabled()] };
      queue.setRepeatMode(QueueRepeatMode.OFF);
      if (savedPlayback.filters.length) await queue.filters.ffmpeg.setFilters(false).catch(() => undefined);
      const metadata = (queue.metadata || {}) as QueueMetadata;
      metadata.guessGame = true;
      queue.metadata = metadata;
      Object.assign(queue.options as any, GAME_OPTIONS);
    } else {
      const settings = await GuildSettingsService.getInstance().getSettings(guild.id).catch(() => null);
      const metadata: QueueMetadata = { channel: text as unknown as TextChannel, audioBitrate: 128, guessGame: true };
      queue = player.nodes.create(guild, {
        metadata,
        ...GAME_OPTIONS,
        selfDeaf: true,
        volume: Math.min(settings?.maxVolume ?? 100, settings?.defaultVolume ?? 80),
        bufferingTimeout: 3_000,
        connectionTimeout: 120_000
      });
    }
    stopLiveLyrics(guild.id);

    try {
      if (!queue.connection || queue.channel?.id !== voice.id) await queue.connect(voice, { deaf: true });
    } catch (error) {
      console.warn("[GuessGame] Could not join voice:", (error as Error)?.message ?? error);
      if (saved) {
        Object.assign(queue.options as any, saved);
        if (savedPlayback) {
          queue.setRepeatMode(savedPlayback.repeatMode);
          if (savedPlayback.filters.length) await queue.filters.ffmpeg.setFilters(savedPlayback.filters).catch(() => undefined);
        }
        ((queue.metadata || {}) as QueueMetadata).guessGame = false;
      } else if (!queue.deleted) {
        queue.delete();
      }
      return interaction.editReply({ content: `⚠️ ${i18n.__("guess.connectFailed")}` });
    }

    const game: Game = {
      id: randomBytes(3).toString("hex"),
      guildId: guild.id,
      textChannel: text,
      voiceChannelId: voice.id,
      starterId: interaction.user.id,
      genre,
      totalRounds,
      pool,
      picks: pickRoundTracks(pool, totalRounds),
      used: new Set(),
      scores: new Map(),
      round: null,
      locale: await localeForGuild(guild),
      queue,
      saved,
      savedPlayback,
      introMessage: null,
      timers: new Set(),
      emptyTimer: null,
      ended: false
    };
    try {
      game.introMessage = await interaction.editReply({ components: [renderIntro(game)], flags: V2, allowedMentions: NO_MENTIONS } as any);
    } catch (error) {
      // No intro, no game: give the queue back instead of blocking music commands.
      console.warn("[GuessGame] Could not post the intro:", (error as Error)?.message ?? error);
      if (saved) {
        Object.assign(queue.options as any, saved);
        if (savedPlayback) {
          queue.setRepeatMode(savedPlayback.repeatMode);
          if (savedPlayback.filters.length) await queue.filters.ffmpeg.setFilters(savedPlayback.filters).catch(() => undefined);
        }
        ((queue.metadata || {}) as QueueMetadata).guessGame = false;
      } else if (!queue.deleted) {
        queue.delete();
      }
      return;
    }
    games.set(guild.id, game);
    byId.set(game.id, game);
    ensureListeners(interaction.client);
    console.log(`[GuessGame] Game ${game.id} started in ${guild.id}: ${totalRounds} rounds of ${genre} (${pool.length} songs)`);
    schedule(game, () => startRound(game, 1), INTRO_MS);
  } finally {
    starting.delete(guild.id);
  }
}

/** /guess stop */
export async function stopGame(interaction: ChatInputCommandInteraction<"cached">): Promise<unknown> {
  const game = games.get(interaction.guildId);
  if (!game || game.ended) return interaction.reply({ content: `🎮 ${i18n.__("guess.noGame")}`, flags: EPHEMERAL });
  if (!canStop(interaction.member, game)) {
    return interaction.reply({ content: `🔒 ${i18n.__("guess.stopNotAllowed")}`, flags: EPHEMERAL });
  }
  await interaction.reply({ content: `⏹️ ${i18n.__("guess.stopped")}`, flags: EPHEMERAL });
  return endGame(game, "stopped", interaction.user.id);
}

// --------------------------------------------------------------- buttons

async function onAnswer(interaction: ButtonInteraction<"cached">, game: Game, roundNo: number, choice: number): Promise<unknown> {
  const round = game.round;
  if (!round || round.index !== roundNo || round.resolved) {
    return interaction.reply({ content: `⌛ ${i18n.__("guess.roundOver")}`, flags: EPHEMERAL });
  }
  const voiceId = game.queue.channel?.id ?? game.voiceChannelId;
  if (interaction.member.voice.channelId !== voiceId) {
    return interaction.reply({ content: `🔇 ${i18n.__mf("guess.joinToPlay", { channel: `<#${voiceId}>` })}`, flags: EPHEMERAL });
  }
  const userId = interaction.user.id;
  if (round.lockedOut.has(userId)) {
    return interaction.reply({ content: `🔒 ${i18n.__("guess.alreadyAnswered")}`, flags: EPHEMERAL });
  }

  if (choice !== round.correctIndex) {
    round.lockedOut.add(userId);
    const reply = interaction.reply({ content: `❌ ${i18n.__("guess.wrong")}`, flags: EPHEMERAL });
    // Everyone listening has guessed wrong: no point waiting for the timer.
    const listeners = humansInVoice(game);
    if (listeners > 0 && round.lockedOut.size >= listeners) void revealRound(game, round);
    return reply;
  }

  // Correct, and first: claim the round before anything async.
  round.resolved = true;
  if (round.timer) clearTimeout(round.timer);
  const elapsedMs = Date.now() - round.startedAt;
  const points = scoreFor(elapsedMs, ROUND_MS);
  const entry = game.scores.get(userId) ?? { points: 0, correct: 0 };
  entry.points += points;
  entry.correct += 1;
  game.scores.set(userId, entry);
  scheduleNext(game, round);
  return interaction.update({
    components: [renderReveal(game, round, { userId, elapsedMs, points })],
    allowedMentions: NO_MENTIONS
  } as any);
}

registerComponentHandler("guess", async (interaction, args) => {
  if (!isButton(interaction)) return;
  const [gameId, roundArg, choiceArg] = args;
  const game = byId.get(gameId ?? "");
  if (!game || game.ended || !interaction.inCachedGuild() || interaction.guildId !== game.guildId) {
    return interaction.reply({ content: `🏁 ${i18n.__("guess.gameOver")}`, flags: EPHEMERAL });
  }
  if (roundArg === "stop") {
    if (!canStop(interaction.member, game)) {
      return interaction.reply({ content: `🔒 ${i18n.__("guess.stopNotAllowed")}`, flags: EPHEMERAL });
    }
    await interaction.deferUpdate();
    return endGame(game, "stopped", interaction.user.id);
  }
  return onAnswer(interaction, game, Number(roundArg), Number(choiceArg));
});
