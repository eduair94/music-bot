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
 *  - bitrate: the tier's kbps, capped by what Discord lets the channel carry
 *    (see `targetKbps`), up to Opus's 510 kbps ceiling;
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

/** The libopus binding the stream wrapper holds (mediaplex, @discordjs/opus or opusscript). */
interface LibopusEncoder {
  setBitrate?(bitrate: number): void;
  getBitrate?(): number;
  applyEncoderCtl?(request: number, value: number): void;
  applyEncoderCTL?(request: number, value: number): void;
  encoderCTL?(request: number, value: number): void;
}

export type ChannelCapPolicy = "channel" | "none";

/**
 * Whether the encoder may go above the voice channel's bitrate setting.
 * "channel" (default) keeps it at the channel's limit, which is what
 * Discord's own clients do, but never under CHANNEL_CAP_FLOOR_KBPS; "none"
 * ignores the channel. Set VOICE_BITRATE_CAP=none once a probe
 * (scripts/probeVoiceBitrate.cjs) shows Discord delivers more than the
 * channel setting.
 */
export function capPolicy(): ChannelCapPolicy {
  return process.env.VOICE_BITRATE_CAP === "none" ? "none" : "channel";
}

/**
 * The bitrate to encode at: the tier's, never above what the channel carries
 * (when the policy caps), and inside Opus's range.
 *
 * @param tierKbps  what this queue is entitled to (128 free, 320 premium/vote/boost)
 * @param channelBps the voice channel's `bitrate` setting in bits per second
 */
export function targetKbps(tierKbps: number, channelBps: number | null | undefined, policy: ChannelCapPolicy = capPolicy()): number {
  let kbps = Number.isFinite(tierKbps) && tierKbps > 0 ? tierKbps : 128;
  if (policy === "channel" && channelBps && channelBps > 0) {
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
