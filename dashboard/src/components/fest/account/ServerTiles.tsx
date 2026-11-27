import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, Pause, Plus, ShieldCheck, User, Volume2 } from "lucide-react";
import { stage } from "@/lib/dash/stages";
import type { StageLane, StagePresence } from "@/lib/stage-presence";
import { GuildBadge } from "../TopBar";
import { cx } from "./styles";

export interface ServerTile {
  id: string;
  name: string;
  icon: string | null;
  manage: boolean;
}

/**
 * A server with Bypass, set as one row of the bill: the server's name, then
 * one lane per Bypass bot in its stage colour (on air with what it plays and
 * where, on the bench, off air, or a dashed lane when it isn't in the
 * server). The whole row opens the server's Fleet.
 */
export function ServerRow({ guild, presence, row = 0 }: { guild: ServerTile; presence?: StagePresence; row?: number }) {
  const lanes = presence?.lanes ?? [];
  const cols = Math.max(2, Math.min(lanes.length || 1, 4));
  return (
    <Link
      href={`/servers/${guild.id}`}
      className="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-4 border-t-2 border-ink px-2 py-5 transition-colors duration-150 hover:bg-paper/80 focus-visible:bg-paper/80 sm:px-3 lg:grid-cols-12 lg:gap-x-8"
    >
      <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-4 lg:col-span-4">
        <GuildBadge guild={guild} size={56} />
        <span className="min-w-0">
          <span className="bill block truncate text-[34px] leading-[0.9] sm:text-[40px]">{guild.name}</span>
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-ink-2">
            <span className="flex items-center gap-1.5">
              {guild.manage ? <ShieldCheck size={14} aria-hidden /> : <User size={14} aria-hidden />}
              {guild.manage ? "Manage Server" : "Member"}
            </span>
            {presence ? (
              <span>
                <span className="clock text-[15px] text-ink">{presence.onAir}</span> on air ·{" "}
                <span className="clock text-[15px] text-ink">{presence.bench}</span> on the bench
              </span>
            ) : null}
          </span>
        </span>
      </span>

      <ArrowRight
        size={22}
        aria-hidden
        className="col-start-2 row-start-1 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1 lg:absolute lg:right-3 lg:top-1/2 lg:-mt-[11px]"
      />

      <span
        className="col-span-2 row-start-2 grid grid-cols-2 gap-1.5 sm:[grid-template-columns:repeat(var(--lanes),minmax(0,1fr))] lg:col-span-8 lg:col-start-5 lg:row-start-1 lg:pr-11"
        style={{ "--lanes": cols } as CSSProperties}
      >
        {lanes.length ? (
          lanes.map((lane, i) => <Lane key={lane.instance} lane={lane} delay={Math.min(row * 3 + i, 12) * 70} />)
        ) : (
          <UnknownLane />
        )}
      </span>
    </Link>
  );
}

function Lane({ lane, delay }: { lane: StageLane; delay: number }) {
  const s = stage(lane.instance);
  const air = lane.state === "air";
  const where = lane.channel ?? "Voice";
  const label = air
    ? (lane.title ?? `Waiting in ${where}`)
    : lane.state === "bench"
      ? "On the bench"
      : lane.state === "off"
        ? "Off air"
        : "Not in server";

  return (
    <span
      className={cx(
        "flex min-h-[88px] min-w-0 flex-col overflow-hidden rounded-[3px]",
        air && "print-pull",
        lane.state === "off" && "hatch border border-ink/25",
        lane.state === "out" && "border-[1.5px] border-dashed border-ink/40",
      )}
      style={
        air
          ? { background: s.color, color: s.on, animationDelay: `${delay}ms` }
          : lane.state === "bench"
            ? { background: `color-mix(in srgb, ${s.tint} 70%, transparent)` }
            : undefined
      }
      title={air && lane.title ? `${lane.title}${lane.author ? ` · ${lane.author}` : ""} · ${lane.name} in ${where}` : undefined}
    >
      {/* The stage's colour rule: solid when it's in the server, grey when it's off air, absent when it isn't there. */}
      <span
        aria-hidden
        className="h-1.5 shrink-0"
        style={{ background: air || lane.state === "bench" ? s.color : lane.state === "off" ? "rgb(21 21 21 / 0.3)" : "transparent" }}
      />
      <span className="flex flex-1 flex-col justify-between gap-2 px-3 pb-3 pt-2">
        <span className={cx("bill line-clamp-2 text-[21px] leading-[0.95]", lane.state === "off" && "text-ink-2", lane.state === "out" && "text-ink-3")}>{label}</span>
        <span className={cx("flex min-w-0 items-center gap-1.5 text-[12.5px] font-semibold", air ? "opacity-90" : lane.state === "out" ? "text-ink-3" : "text-ink-2")}>
          {air ? lane.paused ? <Pause size={13} aria-label="Paused" className="shrink-0" /> : <Volume2 size={13} aria-hidden className="shrink-0" /> : null}
          <span className="truncate">{air ? `${lane.name} · ${where}` : lane.name}</span>
        </span>
      </span>
    </span>
  );
}

/** Bypass is in the server but live state couldn't be read (Redis unavailable). */
function UnknownLane() {
  return (
    <span className="col-span-full flex min-h-[88px] min-w-0 flex-col overflow-hidden rounded-[3px] border border-rule sm:col-span-1">
      <span aria-hidden className="h-1.5 shrink-0" style={{ background: stage(1).color }} />
      <span className="flex flex-1 flex-col justify-between gap-2 px-3 pb-3 pt-2">
        <span className="bill text-[21px] leading-[0.95]">Bypass</span>
        <span className="text-[12.5px] font-semibold text-ink-2">Live state unavailable right now</span>
      </span>
    </span>
  );
}

/** A server you manage where Bypass is missing: dashed, because it's absent. */
export function InviteTile({ guild, href }: { guild: ServerTile; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Add Bypass to ${guild.name} (opens Discord)`}
      className="group flex min-w-0 items-center gap-3.5 rounded-[4px] border-[1.5px] border-dashed border-ink/45 px-3 py-3 transition-colors duration-150 hover:border-ink hover:bg-ink hover:text-stock focus-visible:bg-ink focus-visible:text-stock"
    >
      <span className="opacity-80 grayscale transition-[filter,opacity] duration-150 group-hover:opacity-100 group-hover:grayscale-0">
        <GuildBadge guild={guild} size={36} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{guild.name}</span>
      <span className="flex shrink-0 items-center gap-1 text-[13px] font-semibold">
        <Plus size={14} aria-hidden />
        Add Bypass
        <ArrowUpRight size={14} aria-hidden className="opacity-60" />
      </span>
    </a>
  );
}
