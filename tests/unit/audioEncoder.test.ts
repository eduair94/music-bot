import { describe, expect, it } from "vitest";
import { OpusEncoder } from "mediaplex";
import { configureEncoder, encoderOf, OPUS_CTL, targetKbps } from "../../services/audioEncoder";

describe("targetKbps", () => {
  it("keeps the tier when the channel allows it", () => {
    expect(targetKbps(320, 384_000, "channel")).toBe(320);
    expect(targetKbps(128, 384_000, "channel")).toBe(128);
  });

  it("caps at the channel's bitrate under the channel policy", () => {
    expect(targetKbps(320, 96_000, "channel")).toBe(96);
    expect(targetKbps(320, 256_000, "channel")).toBe(256);
    expect(targetKbps(128, 128_000, "channel")).toBe(128);
  });

  it("never caps below the rate every channel already received", () => {
    expect(targetKbps(320, 64_000, "channel")).toBe(96);
    expect(targetKbps(128, 8_000, "channel")).toBe(96);
  });

  it("ignores the channel when the policy says so", () => {
    expect(targetKbps(320, 64_000, "none")).toBe(320);
  });

  it("stays inside Opus's range and defaults a missing tier to 128", () => {
    expect(targetKbps(999, null, "none")).toBe(510);
    expect(targetKbps(8, 8_000, "none")).toBe(32);
    expect(targetKbps(Number.NaN, undefined, "channel")).toBe(128);
  });
});

describe("configureEncoder", () => {
  it("sets the real libopus encoder (mediaplex) above discord-player's 128 kbps clamp", () => {
    const encoder = new OpusEncoder(48_000, 2);
    expect(configureEncoder(encoder, 320)).toBe(320);
    expect(encoder.getBitrate()).toBe(320_000);
  });

  it("encodes music at the bitrate it was set to", () => {
    const encoder = new OpusEncoder(48_000, 2);
    configureEncoder(encoder, 256);
    // Two seconds of a dense stereo signal (noise + tones) in 20 ms frames.
    let bytes = 0;
    let seed = 1;
    for (let f = 0; f < 100; f++) {
      const pcm = Buffer.alloc(960 * 2 * 2);
      for (let i = 0; i < 960; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const t = (f * 960 + i) / 48_000;
        const v = 6000 * Math.sin(2 * Math.PI * 440 * t) + 3000 * Math.sin(2 * Math.PI * 3520 * t) + ((seed % 8000) - 4000);
        pcm.writeInt16LE(Math.round(v), i * 4);
        pcm.writeInt16LE(Math.round(v * 0.8), i * 4 + 2);
      }
      bytes += encoder.encode(pcm).length;
    }
    const kbps = (bytes * 8) / 2 / 1000;
    expect(kbps).toBeGreaterThan(200);
    expect(kbps).toBeLessThan(300);
  });

  it("falls back to the CTL call when the binding has no setBitrate", () => {
    const calls: [number, number][] = [];
    const binding = { applyEncoderCTL: (r: number, v: number) => void calls.push([r, v]) };
    expect(configureEncoder(binding, 192)).toBe(192);
    expect(calls[0]).toEqual([OPUS_CTL.SET_BITRATE, 192_000]);
    expect(calls.map(([r]) => r)).toContain(OPUS_CTL.SET_SIGNAL);
  });

  it("does nothing without an encoder", () => {
    expect(configureEncoder(null, 320)).toBeNull();
    expect(encoderOf(null)).toBeNull();
  });
});
