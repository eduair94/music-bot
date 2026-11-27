/**
 * The Opus encoder that actually sends music to Discord.
 *
 * discord-player turns every track into PCM and hands it to an Opus encoder
 * (`@discord-player/opus` around mediaplex's libopus). Nothing ever set that
 * encoder's bitrate, so every listener got libopus's default for 48 kHz
 * stereo, 120 kbps, whatever tier the server or listener had paid or voted
 * for. discord-player's own `queue.node.setBitrate` cannot fix it: the
 * wrapper calls `applyEncoderCTL` (mediaplex names it `applyEncoderCtl`),
 * throws, and would clamp to 128 kbps anyway.
 *
 * This module talks to the libopus encoder directly:
 *  - bitrate: the tier's kbps, held to DELIVERED_MAX_KBPS (see `targetKbps`);
 *  - signal = music, so the encoder never switches to its speech (SILK)
 *    modes on quiet passages;
 *  - full band (20 kHz), complexity 10.
 *
 * It is applied every time a new audio resource starts (each track, each
 * filter change, each seek) because discord-player builds a fresh encoder
 * each time.
 */
import type { GuildQueue } from "discord-player";

/** libopus encoder requests (opus_defines.h). */
export const OPUS_CTL = {
  SET_BITRATE: 4002,
  SET_BANDWIDTH: 4008,
  SET_COMPLEXITY: 4010,
  SET_SIGNAL: 4024,
} as const;
const OPUS_SIGNAL_MUSIC = 3002;
const OPUS_BANDWIDTH_FULLBAND = 1105;

/** Opus's own maximum bitrate. */
export const OPUS_MAX_KBPS = 510;
/** Below this music stops sounding like music; never encode lower. */
export const OPUS_MIN_KBPS = 32;
/**
 * The channel cap never pushes the encoder below this. Before this module
 * existed every server got libopus's automatic rate (about 99 kbps of music)
 * whatever its channel was set to, 64 kbps channels included, with no audible
 * loss reported, so this much is known to be delivered.
 */
export const CHANNEL_CAP_FLOOR_KBPS = 96;
/**
 * The highest rate Discord delivers without loss, measured 2026-11-27 with
 * scripts/probeVoiceBitrate.cjs (Bypass 2 receiving the main bot in a 96 kbps
 * channel of an unboosted server):
 *   96 kbps  -> 1500/1500 packets, 96.4 kbps received
 *   256 kbps -> 1503/1495 and 1491/1490 packets, 257 kbps received
 *   320 kbps -> 5-10% of packets missing in every run, 288-306 kbps received
 * Discord ignores the channel's bitrate setting for a bot's stream (300 kbps
 * also arrived through 64k and 8k channels), but something on the path drops
 * packets somewhere between 256 and 320 kbps, so 256 is the ceiling.
 */
export const DELIVERED_MAX_KBPS = 256;

/** The libopus binding the stream wrapper holds (mediaplex, @discordjs/opus or opusscript). */
interface LibopusEncoder {
  setBitrate?(bitrate: number): void;
  getBitrate?(): number;
  applyEncoderCtl?(request: number, value: number): void;
  applyEncoderCTL?(request: number, value: number): void;
  encoderCTL?(request: number, value: number): void;
}

/** "channel", "none", or a fixed ceiling in kbps. */
export type ChannelCapPolicy = "channel" | "none" | number;

/**
 * How the encoder's bitrate is limited. Default: a fixed ceiling of
 * DELIVERED_MAX_KBPS. VOICE_BITRATE_CAP overrides it with another number
 * (a ceiling in kbps), "none" (only the tier), or "channel" (the voice
 * channel's setting, never under CHANNEL_CAP_FLOOR_KBPS, the way Discord's
 * own clients behave). Re-measure with scripts/probeVoiceBitrate.cjs before
 * raising it.
 */
export function capPolicy(): ChannelCapPolicy {
  const value = process.env.VOICE_BITRATE_CAP?.trim();
  if (value === "none" || value === "channel") return value;
  const kbps = Number(value);
  if (value && Number.isFinite(kbps) && kbps >= OPUS_MIN_KBPS) return kbps;
  return DELIVERED_MAX_KBPS;
}

/**
 * The bitrate to encode at: the tier's, never above the policy's limit, and
 * inside Opus's range.
 *
 * @param tierKbps  what this queue is entitled to (128 free, 320 premium/vote/boost)
 * @param channelBps the voice channel's `bitrate` setting in bits per second
 */
export function targetKbps(tierKbps: number, channelBps: number | null | undefined, policy: ChannelCapPolicy = capPolicy()): number {
  let kbps = Number.isFinite(tierKbps) && tierKbps > 0 ? tierKbps : 128;
  if (typeof policy === "number") kbps = Math.min(kbps, policy);
  else if (policy === "channel" && channelBps && channelBps > 0) {
    kbps = Math.min(kbps, Math.max(CHANNEL_CAP_FLOOR_KBPS, Math.floor(channelBps / 1000)));
  }
  return Math.max(OPUS_MIN_KBPS, Math.min(OPUS_MAX_KBPS, Math.round(kbps)));
}

/** The libopus encoder inside the queue's current audio resource, if it has one. */
export function encoderOf(queue: GuildQueue | null | undefined): LibopusEncoder | null {
  const stream = queue?.dispatcher?.audioResource?.encoder as { encoder?: LibopusEncoder | null } | null | undefined;
  return stream?.encoder ?? null;
}

function ctl(encoder: LibopusEncoder, request: number, value: number): void {
  const fn = encoder.applyEncoderCtl ?? encoder.applyEncoderCTL ?? encoder.encoderCTL;
  if (!fn) throw new Error("libopus binding exposes no encoder CTL");
  fn.call(encoder, request, value);
}

/**
 * Configure an encoder for music at `kbps`. Returns the bitrate the encoder
 * reports afterwards (kbps), or null when there is no encoder to configure
 * (a pass-through Opus stream, or the resource already ended).
 */
export function configureEncoder(encoder: LibopusEncoder | null, kbps: number): number | null {
  if (!encoder) return null;
  const bps = Math.round(kbps * 1000);
  if (typeof encoder.setBitrate === "function") encoder.setBitrate(bps);
  else ctl(encoder, OPUS_CTL.SET_BITRATE, bps);
  ctl(encoder, OPUS_CTL.SET_SIGNAL, OPUS_SIGNAL_MUSIC);
  ctl(encoder, OPUS_CTL.SET_BANDWIDTH, OPUS_BANDWIDTH_FULLBAND);
  ctl(encoder, OPUS_CTL.SET_COMPLEXITY, 10);
  const actual = typeof encoder.getBitrate === "function" ? encoder.getBitrate() : bps;
  return Math.round(actual / 1000);
}

/**
 * Apply the music profile to the queue's live encoder. Safe to call at any
 * time; returns the kbps now in effect, or null if there was nothing to set.
 */
export function applyAudioProfile(queue: GuildQueue | null | undefined, tierKbps: number): number | null {
  if (!queue) return null;
  const channelBps = (queue.channel as { bitrate?: number } | null | undefined)?.bitrate;
  try {
    return configureEncoder(encoderOf(queue), targetKbps(tierKbps, channelBps));
  } catch (error) {
    console.warn(`[AudioEncoder] could not configure the encoder in ${queue.guild?.id}:`, (error as Error).message);
    return null;
  }
}
