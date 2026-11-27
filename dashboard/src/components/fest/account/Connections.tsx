"use client";

/**
 * Connected music accounts on the profile page: one ruled row per provider
 * (Spotify, YouTube). Connect is a plain link into the OAuth flow
 * (/api/connect/<p>); Disconnect asks once, calls DELETE, then refreshes the
 * server-rendered rows. The callback lands back here with ?connected=<p> or
 * ?connectError=<code>&provider=<p>, shown once as a notice above the rows.
 */
import { AlertTriangle, ArrowUpRight, Check, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaSpotify, FaYoutube } from "react-icons/fa";
import type { ConnectErrorCode, ConnectionView } from "@/lib/connections";
import { SUPPORT_INVITE_URL } from "../../../../../shared/links";
import { useToast } from "../Toast";
import { Button, cx } from "../ui";
import { btn, textLink } from "./styles";

export type ConnectNotice =
  | { kind: "connected"; provider: string }
  | { kind: "error"; code: ConnectErrorCode; provider: string | null };

const GLYPH: Record<string, typeof FaSpotify> = { spotify: FaSpotify, youtube: FaYoutube };

const LABEL: Record<string, string> = { spotify: "Spotify", youtube: "YouTube" };

/** Where a user removes Bypass from the provider's side, to force a fresh consent. */
const APP_PERMISSIONS: Record<string, { href: string; name: string }> = {
  spotify: { href: "https://www.spotify.com/account/apps/", name: "Spotify's Manage apps page" },
  youtube: { href: "https://myaccount.google.com/permissions", name: "your Google Account's third-party access page" },
};

const Cmd = ({ children }: { children: React.ReactNode }) => <code className="[font-family:inherit] font-semibold text-ink">{children}</code>;

const SupportLink = () => (
  <a href={SUPPORT_INVITE_URL} target="_blank" rel="noreferrer" className={textLink}>
    support server
  </a>
);

/** Deterministic on server and client, so hydration never disagrees. */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function NoticeText({ notice }: { notice: ConnectNotice }) {
  const name = notice.provider ? (LABEL[notice.provider] ?? "the provider") : "the provider";
  if (notice.kind === "connected") {
    return (
      <>
        {name} is connected. Use <Cmd>/library</Cmd> in any server with Bypass to play your playlists and liked songs.
      </>
    );
  }
  switch (notice.code) {
    case "denied":
      return <>You cancelled on {name}, so nothing was connected. Connect again whenever you&apos;re ready.</>;
    case "not_allowlisted":
      return (
        <>
          Bypass&apos;s Spotify app is still in development mode, where Spotify only lets accounts the owner has added by
          hand connect, and yours isn&apos;t on that list yet. Ask in the <SupportLink /> to be added, then connect again.
        </>
      );
    case "no_refresh_token": {
      const page = notice.provider ? APP_PERMISSIONS[notice.provider] : undefined;
      return (
        <>
          {name} didn&apos;t give Bypass lasting access, so the connection wouldn&apos;t survive the hour. Remove Bypass on{" "}
          {page ? (
            <a href={page.href} target="_blank" rel="noreferrer" className={textLink}>
              {page.name}
            </a>
          ) : (
            "the provider's connected apps page"
          )}
          , then connect again.
        </>
      );
    }
    case "state":
      return <>That connection attempt expired or was started in another tab or browser. Start it again from here.</>;
    case "not_configured":
      return <>{name} isn&apos;t set up on this dashboard yet, so it can&apos;t be connected.</>;
    default:
      return (
        <>
          Something went wrong while connecting {name}, and nothing was saved. Try again in a minute; if it keeps failing,
          ask in the <SupportLink />.
        </>
      );
  }
}

export function Connections({
  connections,
  notice: initialNotice,
  demo = false,
}: {
  /** Null when the rows couldn't be read. */
  connections: ConnectionView[] | null;
  notice: ConnectNotice | null;
  demo?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [notice, setNotice] = useState(initialNotice);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  /** Disconnected here; shown as such until the refreshed rows arrive. */
  const [removed, setRemoved] = useState<string[]>([]);

  // Show the callback's outcome once: drop the query so a reload doesn't repeat it.
  useEffect(() => {
    if (initialNotice) window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
  }, [initialNotice]);

  const disconnect = async (row: ConnectionView) => {
    if (demo) {
      toast.push({ tone: "info", title: "Demo mode", detail: "Nothing is sent from the demo." });
      setConfirming(null);
      return;
    }
    setPending(row.provider);
    try {
      const res = await fetch(`/api/connect/${row.provider}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Couldn't disconnect (${res.status})`);
      }
      setConfirming(null);
      setNotice(null);
      setRemoved((r) => [...r, row.provider]);
      toast.push({ title: `Disconnected ${row.label}` });
      router.refresh();
    } catch (e) {
      toast.push({ tone: "error", title: `Couldn't disconnect ${row.label}`, detail: e instanceof Error ? e.message : undefined });
    } finally {
      setPending(null);
    }
  };

  const rows = connections?.map((row) =>
    removed.includes(row.provider) ? { provider: row.provider, label: row.label, available: row.available, connected: false } : row,
  );

  return (
    <section id="connections" aria-labelledby="connections-h" className="mt-16 scroll-mt-24">
      <h2 id="connections-h" className="bill text-[32px]">
        Connections
      </h2>
      <p className="mt-1 max-w-[60ch] text-[15px] text-ink-2">
        Connecting lets the bot play your private playlists and liked songs with <Cmd>/library</Cmd>.
      </p>

      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={cx(
            "mt-4 flex gap-3 rounded-[4px] border bg-paper px-3.5 py-3 text-[14px] leading-snug text-ink",
            notice.kind === "error" ? "border-now" : "border-ink",
          )}
        >
          {notice.kind === "error" ? (
            <AlertTriangle size={18} className="mt-px shrink-0 text-now" aria-hidden />
          ) : (
            <Check size={18} className="mt-px shrink-0" aria-hidden />
          )}
          <p className="min-w-0 flex-1">
            <NoticeText notice={notice} />
          </p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="-mr-1 self-start p-1 text-ink-3 transition-colors hover:text-ink"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
      ) : null}

      {rows ? (
        <ul className="mt-3 border-b border-rule" aria-label="Connected accounts">
          {rows.map((row) => (
            <ConnectionRow
              key={row.provider}
              row={row}
              demo={demo}
              busy={pending === row.provider}
              confirming={confirming === row.provider}
              onAskDisconnect={() => setConfirming(row.provider)}
              onCancelDisconnect={() => setConfirming(null)}
              onDisconnect={() => void disconnect(row)}
              onDemoConnect={() => toast.push({ tone: "info", title: "Demo mode", detail: "Sign in to connect your own accounts." })}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t-2 border-ink pt-4 text-[15px] text-ink-2">
          We couldn&apos;t read your connections just now. Reload the page in a moment.
        </p>
      )}
    </section>
  );
}

function ConnectionRow({
  row,
  demo,
  busy,
  confirming,
  onAskDisconnect,
  onCancelDisconnect,
  onDisconnect,
  onDemoConnect,
}: {
  row: ConnectionView;
  demo: boolean;
  busy: boolean;
  confirming: boolean;
  onAskDisconnect: () => void;
  onCancelDisconnect: () => void;
  onDisconnect: () => void;
  onDemoConnect: () => void;
}) {
  const Glyph = GLYPH[row.provider];
  const status = row.connected
    ? null
    : row.available
      ? "Not connected"
      : "Not configured on this dashboard yet";

  return (
    <li className="border-t border-rule first:border-t-2 first:border-ink">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-2 py-3.5">
        {row.connected && row.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.avatarUrl}
            alt=""
            width={44}
            height={44}
            referrerPolicy="no-referrer"
            className="h-11 w-11 shrink-0 rounded-[4px] border border-ink/20 object-cover"
          />
        ) : (
          <span
            aria-hidden
            className={cx(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px]",
              row.available || row.connected ? "bg-ink text-stock" : "border-[1.5px] border-dashed border-[#8a8378] text-ink-3",
            )}
          >
            {Glyph ? <Glyph size={22} /> : null}
          </span>
        )}

        <div className="min-w-0 flex-1 basis-48">
          <p className="text-[16px] font-semibold">{row.label}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-2 text-[14px] text-ink-2">
            <span
              aria-hidden
              className={cx(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                row.connected ? "bg-ink" : "border-[1.5px] border-dashed",
                !row.connected && (row.available ? "border-ink-3" : "border-[#8a8378]"),
              )}
            />
            {row.connected ? (
              <span className="min-w-0 truncate">
                Connected as <span className="font-semibold text-ink">{row.displayName}</span>
                {row.connectedAt ? <span className="text-ink-3"> · since {fmtDate(row.connectedAt)}</span> : null}
              </span>
            ) : (
              <span>{status}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {row.connected ? (
            <Button size="sm" variant="outline" disabled={busy || confirming} onClick={onAskDisconnect}>
              <Unlink size={14} aria-hidden /> Disconnect
            </Button>
          ) : !row.available ? (
            <Button size="sm" variant="outline" disabled title={`${row.label} isn't set up on this dashboard yet`}>
              Not configured
            </Button>
          ) : demo ? (
            <Button size="sm" variant="ink" onClick={onDemoConnect}>
              Connect <ArrowUpRight size={14} aria-hidden />
            </Button>
          ) : (
            // A full navigation into the OAuth flow, never a client-side route.
            <a href={`/api/connect/${row.provider}`} className={btn("ink", "sm")}>
              Connect <ArrowUpRight size={14} aria-hidden />
            </a>
          )}
        </div>
      </div>

      {confirming ? (
        <div className="mx-2 mb-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[4px] border border-now bg-paper px-3.5 py-2.5">
          <p className="min-w-0 flex-1 text-[14px]">
            Disconnect <strong>{row.displayName ?? row.label}</strong>? Bypass deletes the stored access, and{" "}
            <Cmd>/library</Cmd> stops working until you connect again.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" busy={busy} onClick={onDisconnect}>
              Disconnect
            </Button>
            <Button variant="ghost" size="sm" autoFocus disabled={busy} onClick={onCancelDisconnect}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
