"use client";

/**
 * Top tracks, top requesters and where the music came from. Bars are ink:
 * stage colours stay reserved for the bots, so a top track carries only a
 * chip of the bot that played it most.
 */
import { useState } from "react";
import { fmtCount } from "@/lib/dash/format";
import { stageName } from "@/lib/dash/stages";
import type { Activity } from "@/lib/dash/types";
import { cx } from "../ui";
import { instancesIn, StageChip } from "./stages";

function PlaysBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="h-2 min-w-0 flex-1">
        <div className="h-full rounded-r-[3px] bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <span className="clock w-10 shrink-0 text-right text-[16px] leading-none">{fmtCount(value)}</span>
    </div>
  );
}

function hasLink(url: string | undefined): url is string {
  return Boolean(url && url !== "#" && /^https?:\/\//.test(url));
}

type TopTrack = Activity["topTracks"][number];

/** The track's main bot: the API's pick, else the largest share of its split, else Bypass. */
function dominant(t: TopTrack): number {
  if (Number.isInteger(t.instance) && t.instance >= 1) return t.instance;
  const list = instancesIn(t.byInstance);
  return list.reduce((best, n) => ((t.byInstance[String(n)] ?? 0) > (t.byInstance[String(best)] ?? 0) ? n : best), list[0] ?? 1);
}

/** "Played most by Bypass 2 (24 of 33)", or "All 12 on Bypass". */
function botNote(t: TopTrack, instance: number): string {
  const on = t.byInstance?.[String(instance)] ?? t.plays;
  return on >= t.plays ? `All ${t.plays} on ${stageName(instance)}` : `Played most by ${stageName(instance)} (${on} of ${t.plays})`;
}

/** `showBots` adds the chip of the bot that played each track most (off when the server has one bot). */
export function TopTracks({ items, showBots = false }: { items: Activity["topTracks"]; showBots?: boolean }) {
  if (!items.length) return <p className="py-6 text-[14px] text-ink-2">No songs played in this period.</p>;
  const max = Math.max(...items.map((t) => t.plays));
  return (
    <ol className="divide-y divide-rule">
      {items.map((t, i) => (
        <li
          key={`${t.url}|${t.title}|${i}`}
          className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(5.5rem,38%)] items-center gap-3 py-2.5"
        >
          <span className={cx("clock text-[22px] leading-none", i === 0 ? "text-ink" : "text-ink-3")}>{i + 1}</span>
          <div className="flex min-w-0 items-center gap-3">
            {t.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.thumbnail} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-[3px] object-cover" />
            ) : null}
            <div className="min-w-0">
              {hasLink(t.url) ? (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  className="bill block truncate text-[21px] hover:underline hover:decoration-2 hover:underline-offset-2"
                >
                  {t.title}
                </a>
              ) : (
                <p className="bill truncate text-[21px]">{t.title}</p>
              )}
              <p className="flex min-w-0 items-center gap-2 text-[13px] text-ink-2">
                {showBots ? <StageChip instance={dominant(t)} title={botNote(t, dominant(t))} /> : null}
                <span className="truncate">{t.author}</span>
              </p>
            </div>
          </div>
          <PlaysBar value={t.plays} max={max} />
        </li>
      ))}
    </ol>
  );
}

function avatarUrl(id: string, avatar?: string): string | null {
  if (!avatar) return null;
  if (/^https?:\/\//.test(avatar)) return avatar;
  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=64`;
}

export function TopRequesters({ items }: { items: Activity["topRequesters"] }) {
  if (!items.length) return <p className="py-6 text-[14px] text-ink-2">Nobody requested a song in this period.</p>;
  const max = Math.max(...items.map((r) => r.plays));
  return (
    <ol className="divide-y divide-rule">
      {items.map((r, i) => {
        const src = avatarUrl(r.id, r.avatar);
        return (
          <li key={r.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(5.5rem,42%)] items-center gap-3 py-2.5">
            <span className={cx("clock text-[22px] leading-none", i === 0 ? "text-ink" : "text-ink-3")}>{i + 1}</span>
            <div className="flex min-w-0 items-center gap-2.5">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" width={28} height={28} className="h-7 w-7 shrink-0 rounded-[3px]" />
              ) : (
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] bg-ink text-[12px] font-bold uppercase text-stock"
                >
                  {r.username.slice(0, 1)}
                </span>
              )}
              <span className="truncate text-[15px] font-semibold">{r.username}</span>
            </div>
            <PlaysBar value={r.plays} max={max} />
          </li>
        );
      })}
    </ol>
  );
}

// ── Sources ─────────────────────────────────────────────────────────────────

const SOURCE_NAMES: Record<string, string> = {
  youtube: "YouTube",
  youtube_music: "YouTube Music",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  deezer: "Deezer",
  applemusic: "Apple Music",
  apple_music: "Apple Music",
  apple: "Apple Music",
  attachment: "Audio files",
  file: "Audio files",
  arbitrary: "Audio files",
};

/**
 * Ink tones follow the source, never its rank, so a source keeps its tone
 * from one period to the next. Three solid tones (validated apart) and one
 * hatched; every other source folds into a dashed "Other".
 */
const TONES: { key: string; fill: string; text: string; hatch?: boolean }[] = [
  { key: "youtube", fill: "#151515", text: "#f2ede4" },
  { key: "spotify", fill: "#5a554d", text: "#f2ede4" },
  { key: "soundcloud", fill: "#a1998b", text: "#151515" },
  { key: "deezer", fill: "#151515", text: "#151515", hatch: true },
];

interface Part {
  key: string;
  name: string;
  plays: number;
  tone?: (typeof TONES)[number];
  members?: string[];
}

function sourceParts(sources: Record<string, number>): Part[] {
  const entries = Object.entries(sources).filter(([, v]) => v > 0);
  const parts: Part[] = [];
  for (const t of TONES) {
    const hit = entries.find(([k]) => k.toLowerCase() === t.key);
    if (hit) parts.push({ key: t.key, name: SOURCE_NAMES[t.key], plays: hit[1], tone: t });
  }
  const rest = entries.filter(([k]) => !TONES.some((t) => t.key === k.toLowerCase()));
  if (rest.length) {
    const names = [...new Set(rest.map(([k]) => SOURCE_NAMES[k.toLowerCase()] ?? k.charAt(0).toUpperCase() + k.slice(1)))];
    parts.push({ key: "other", name: names.length === 1 ? names[0] : "Other", plays: rest.reduce((a, [, v]) => a + v, 0), members: names });
  }
  return parts;
}

function partStyle(p: Part): React.CSSProperties {
  if (!p.tone) return { background: "transparent", border: "1.5px dashed #6b665d" };
  if (p.tone.hatch)
    return { backgroundColor: "#e8e1d4", backgroundImage: "repeating-linear-gradient(-45deg, #151515 0 2px, transparent 2px 6px)" };
  return { background: p.tone.fill };
}

export function SourcesBar({ sources }: { sources: Record<string, number> }) {
  const parts = sourceParts(sources);
  const total = parts.reduce((a, p) => a + p.plays, 0);
  const [hover, setHover] = useState<string | null>(null);
  if (!total) return <p className="py-6 text-[14px] text-ink-2">No sources to show yet.</p>;
  const share = (p: Part) => Math.round((p.plays / total) * 100);
  // A block prints its share only when it's wide enough and solid.
  const printsInside = (p: Part) => Boolean(p.tone && !p.tone.hatch && p.plays / total >= 0.14);

  return (
    <div>
      <div className="flex h-7 gap-[2px]" role="img" aria-label={`Sources: ${parts.map((p) => `${p.name} ${share(p)}%`).join(", ")}`}>
        {parts.map((p) => (
          <div
            key={p.key}
            title={`${p.name}: ${fmtCount(p.plays)} plays (${share(p)}%)`}
            onPointerEnter={() => setHover(p.key)}
            onPointerLeave={() => setHover(null)}
            className={cx(
              "flex min-w-[4px] items-center overflow-visible rounded-[4px] px-2 transition-opacity duration-150",
              hover && hover !== p.key && "opacity-45",
            )}
            style={{ flex: `${p.plays} 1 0`, ...partStyle(p) }}
          >
            {printsInside(p) ? (
              <span className="clock whitespace-nowrap text-[14px] leading-none" style={{ color: p.tone!.text }}>
                {share(p)}%
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {parts.map((p) => (
          <li
            key={p.key}
            onPointerEnter={() => setHover(p.key)}
            onPointerLeave={() => setHover(null)}
            className="flex items-center gap-2.5 text-[14px]"
          >
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px]" style={partStyle(p)} />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {p.name}
              {p.members && p.members.length > 1 ? <span className="font-normal text-ink-3"> ({p.members.join(", ")})</span> : null}
            </span>
            <span className="clock text-[15px]">{fmtCount(p.plays)}</span>
            <span className="clock w-10 text-right text-[13px] text-ink-3">{printsInside(p) ? "" : `${share(p)}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
