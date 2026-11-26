import { escapeMarkdown } from "discord.js";

/** 83_000 → "1:23", 3_723_000 → "1:02:03". */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms) || ms < 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "1:23", "01:02:03" or "83" → milliseconds; null when unparseable. */
export function parseTimestamp(input: string): number | null {
  const parts = input.trim().split(":").map((p) => p.trim());
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const seconds = parts.reduce((acc, part) => acc * 60 + Number(part), 0);
  return seconds * 1000;
}

/** A text progress bar: `━━━━━●─────────`. */
export function progressBar(currentMs: number, totalMs: number, size = 16): string {
  if (!totalMs || totalMs <= 0) return "─".repeat(size);
  const ratio = Math.min(1, Math.max(0, currentMs / totalMs));
  const pos = Math.min(size - 1, Math.round(ratio * (size - 1)));
  return "━".repeat(pos) + "●" + "─".repeat(size - 1 - pos);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

/**
 * Safe text for a markdown link label: escaped markdown, no brackets that
 * would end the label early, bounded length.
 */
export function linkLabel(text: string, max = 80): string {
  return escapeMarkdown(truncate(text, max)).replace(/[\[\]]/g, "");
}

/** Escaped plain text, bounded length. */
export function safeText(text: string | null | undefined, max = 100): string {
  return escapeMarkdown(truncate(text || "", max));
}

/** Only http(s) URLs are safe to put in a markdown link or a link button. */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
