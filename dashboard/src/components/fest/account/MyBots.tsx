"use client";

/**
 * Your own bots: run the Bypass player on a Discord bot you created. Same API
 * as before (/api/user/bots): list, link by token, start/stop/restart, unlink.
 * The token field is a password input, is cleared after every attempt, and
 * is never shown back; the API never returns it either.
 */
import Link from "next/link";
import { ArrowRight, Bot, KeyRound, Play, Plus, RotateCw, Square, Unlink } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import type { LinkedBotStatus } from "../../../../../shared/types";
import { fmtAgo } from "@/lib/dash/format";
import { useToast } from "../Toast";
import { Button, cx, IconButton, TextInput } from "../ui";
import { PageHead } from "./PageHead";

interface LinkedBot {
  _id: string;
  botId: string;
  botUsername: string;
  botAvatar: string | null;
  status: LinkedBotStatus;
  lastStatusChange: string;
  lastError: string | null;
  totalGuilds: number;
  totalSongsPlayed: number;
  createdAt: string;
}

interface BotsResponse {
  bots: LinkedBot[];
  tier: string;
  limit: number;
  count: number;
  canLinkMore: boolean;
}

type Action = "start" | "stop" | "restart";

const TIER: Record<string, string> = { free: "Free", basic: "Founder", pro: "Pro", enterprise: "Enterprise" };

const STATUS: Record<LinkedBotStatus, { label: string; dot: string }> = {
  online: { label: "Online", dot: "bg-stage-4" },
  starting: { label: "Starting", dot: "bg-stage-3 now-dot" },
  error: { label: "Error", dot: "bg-now" },
  offline: { label: "Offline", dot: "border-[1.5px] border-dashed border-ink-3" },
  stopped: { label: "Stopped", dot: "border-[1.5px] border-dashed border-ink-3" },
};

/** Demo mode without a session: one linked bot, nothing is sent anywhere. */
const DEMO_DATA: BotsResponse = {
  tier: "basic",
  limit: 1,
  count: 1,
  canLinkMore: false,
  bots: [
    {
      _id: "demo-bot",
      botId: "100000000000000099",
      botUsername: "Night Owls Radio",
      botAvatar: null,
      status: "online",
      lastStatusChange: new Date(Date.now() - 3 * 3600_000).toISOString(),
      lastError: null,
      totalGuilds: 2,
      totalSongsPlayed: 418,
      createdAt: "2026-11-02T20:00:00Z",
    },
  ],
};

async function readJson(res: Response): Promise<{ error?: string } & Record<string, unknown>> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function MyBots({ demo = false }: { demo?: boolean }) {
  const toast = useToast();
  const [data, setData] = useState<BotsResponse | null>(demo ? DEMO_DATA : null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/bots", { cache: "no-store" });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || `Couldn't load your bots (${res.status})`);
      setData(body as unknown as BotsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your bots");
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => {
    void fetchBots();
  }, [fetchBots]);

  const act = async (bot: LinkedBot, action: Action) => {
    if (demo) {
      toast.push({ tone: "info", title: "Demo mode", detail: "Nothing is sent from the demo." });
      return;
    }
    setPending(`${bot.botId}-${action}`);
    try {
      const res = await fetch(`/api/user/bots/${bot.botId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await readJson(res);
      if (!res.ok) throw new Error(body.error || `Couldn't ${action} the bot`);
      toast.push({ title: `${bot.botUsername}: ${action === "stop" ? "stopping" : action === "start" ? "starting" : "restarting"}` });
      setTimeout(() => void fetchBots(), 1000);
    } catch (e) {
      toast.push({ tone: "error", title: `Couldn't ${action} ${bot.botUsername}`, detail: e instanceof Error ? e.message : undefined });
    } finally {
      setPending(null);
    }
  };

  const unlink = async (bot: LinkedBot) => {
    if (demo) {
      toast.push({ tone: "info", title: "Demo mode", detail: "Nothing is sent from the demo." });
      setConfirming(null);
      return;
    }
    setPending(`${bot.botId}-delete`);
    try {
      const res = await fetch(`/api/user/bots/${bot.botId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await readJson(res)).error || "Couldn't unlink the bot");
      setConfirming(null);
      toast.push({ title: `Unlinked ${bot.botUsername}` });
      void fetchBots();
    } catch (e) {
      toast.push({ tone: "error", title: `Couldn't unlink ${bot.botUsername}`, detail: e instanceof Error ? e.message : undefined });
    } finally {
      setPending(null);
    }
  };

  const tier = TIER[data?.tier ?? "free"] ?? "Free";
  const locked = data !== null && data.limit === 0;
  const status = loading && !data
    ? "Loading your bots…"
    : error && !data
      ? "Couldn't load your bots"
      : data
        ? `${data.count} of ${data.limit} linked · ${tier} plan`
        : "";

  return (
    <>
      <PageHead
        title="Your own bots"
        status={status}
        actions={
          <>
            <IconButton label="Refresh" className="border border-ink hover:bg-ink hover:text-stock" onClick={() => void fetchBots()} disabled={loading || demo}>
              <RotateCw size={16} className={cx(loading && "animate-spin")} />
            </IconButton>
            {!locked ? (
              <Button variant="ink" size="sm" disabled={!data?.canLinkMore || linking} onClick={() => setLinking(true)} title={data && !data.canLinkMore ? "You've used every bot slot on your plan" : undefined}>
                <Plus size={14} /> Link a bot
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-x-10 gap-y-10 px-4 pb-24 pt-6 sm:px-6 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          {linking && !demo ? (
            <LinkForm
              onCancel={() => setLinking(false)}
              onLinked={(name) => {
                setLinking(false);
                toast.push({ title: `Linked ${name}`, detail: "Start it when you're ready." });
                void fetchBots();
              }}
            />
          ) : linking && demo ? (
            <p className="mb-5 rounded-[4px] border-[1.5px] border-dashed border-ink/40 px-4 py-3 text-[14px] text-ink-2">
              Linking is off in the demo.{" "}
              <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setLinking(false)}>
                Close
              </button>
            </p>
          ) : null}

          {error && !data ? (
            <section className="py-4">
              <h2 className="bill text-[40px]">Couldn&apos;t load your bots</h2>
              <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">{error}. Try again in a few seconds.</p>
              <Button variant="ink" className="mt-5" onClick={() => void fetchBots()}>
                <RotateCw size={16} /> Try again
              </Button>
            </section>
          ) : loading && !data ? (
            <div aria-busy="true" aria-label="Loading your bots">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-4 border-t-2 border-ink/15 py-4">
                  <div className="h-12 w-12 animate-pulse rounded-[4px] bg-ink/10" />
                  <div className="h-7 w-48 animate-pulse rounded-[3px] bg-ink/10" />
                </div>
              ))}
            </div>
          ) : locked ? (
            <section className="rounded-[4px] border-[1.5px] border-dashed border-ink/45 p-5 sm:p-6">
              <h2 className="bill text-[34px]">Linking a bot comes with Founder</h2>
              <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">
                The Founder tier on Patreon lets you link one bot of your own. Your plan today is {tier}.
              </p>
              <Link href="/premium" className="mt-4 inline-flex h-10 items-center gap-2 rounded-[4px] bg-ink px-4 text-sm font-semibold text-stock transition-colors hover:bg-ink-2">
                See Premium <ArrowRight size={16} aria-hidden />
              </Link>
            </section>
          ) : data && data.bots.length === 0 ? (
            !linking ? (
              <section className="rounded-[4px] border-[1.5px] border-dashed border-ink/45 p-5 sm:p-6">
                <h2 className="bill text-[34px]">No bots linked yet</h2>
                <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">
                  Link a bot you created in the Discord Developer Portal and Bypass runs its music player under that bot&apos;s name
                  and avatar.
                </p>
                <Button variant="ink" className="mt-4" onClick={() => setLinking(true)}>
                  <Plus size={16} /> Link a bot
                </Button>
              </section>
            ) : null
          ) : data ? (
            <ul className="border-b border-rule" aria-label="Linked bots">
              {data.bots.map((bot) => (
                <BotRow
                  key={bot.botId}
                  bot={bot}
                  pending={pending}
                  confirming={confirming === bot.botId}
                  onAction={(a) => void act(bot, a)}
                  onAskUnlink={() => setConfirming(bot.botId)}
                  onCancelUnlink={() => setConfirming(null)}
                  onUnlink={() => void unlink(bot)}
                />
              ))}
            </ul>
          ) : null}
        </div>

        <aside className="min-w-0 lg:col-span-4">
          <h2 className="bill text-[28px]">How it works</h2>
          <ol className="mt-3 space-y-3 border-t-2 border-ink pt-4 text-[14px] leading-relaxed text-ink-2">
            <li>
              In the{" "}
              <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="font-semibold text-ink underline underline-offset-2">
                Discord Developer Portal
              </a>
              , create an application and add a bot to it.
            </li>
            <li>On the Bot page, reset the token and copy it. Discord shows it once.</li>
            <li>Paste it here. Bypass encrypts it before storing it and never shows it again.</li>
            <li>Invite your bot to a server and start it from this page.</li>
          </ol>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
            Treat a bot token like a password. Bypass staff will never ask you for it.
          </p>
        </aside>
      </div>
    </>
  );
}

function BotRow({
  bot,
  pending,
  confirming,
  onAction,
  onAskUnlink,
  onCancelUnlink,
  onUnlink,
}: {
  bot: LinkedBot;
  pending: string | null;
  confirming: boolean;
  onAction: (a: Action) => void;
  onAskUnlink: () => void;
  onCancelUnlink: () => void;
  onUnlink: () => void;
}) {
  const s = STATUS[bot.status] ?? STATUS.offline;
  const running = bot.status === "online" || bot.status === "starting";
  const busy = pending?.startsWith(`${bot.botId}-`) ?? false;
  return (
    <li className="border-t-2 border-ink py-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {bot.botAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://cdn.discordapp.com/avatars/${bot.botId}/${bot.botAvatar}.png?size=96`}
            alt=""
            width={52}
            height={52}
            className="h-[52px] w-[52px] shrink-0 rounded-[4px] border border-ink/20"
          />
        ) : (
          <span aria-hidden className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[4px] bg-ink text-stock">
            <Bot size={24} />
          </span>
        )}
        <div className="min-w-0 flex-1 basis-48">
          <p className="bill truncate text-[30px] leading-[0.95]">{bot.botUsername}</p>
          <p className="mt-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink-2">
            <span aria-hidden className={cx("h-2.5 w-2.5 shrink-0 rounded-full", s.dot)} />
            {s.label}
            <span className="font-normal text-ink-3">· {fmtAgo(bot.lastStatusChange)}</span>
          </p>
        </div>
        <dl className="flex gap-6">
          <div>
            <dt className="text-[12px] text-ink-3">Servers</dt>
            <dd className="clock text-[24px] leading-none">{bot.totalGuilds.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-3">Songs played</dt>
            <dd className="clock text-[24px] leading-none">{bot.totalSongsPlayed.toLocaleString()}</dd>
          </div>
        </dl>
        <div className="flex items-center gap-1.5">
          {running ? (
            <Button size="sm" variant="outline" busy={pending === `${bot.botId}-stop`} disabled={busy} onClick={() => onAction("stop")}>
              <Square size={13} /> Stop
            </Button>
          ) : (
            <Button size="sm" variant="ink" busy={pending === `${bot.botId}-start`} disabled={busy} onClick={() => onAction("start")}>
              <Play size={13} /> Start
            </Button>
          )}
          <IconButton
            label="Restart"
            size={32}
            className="hover:bg-ink/[0.07]"
            disabled={busy || bot.status === "offline"}
            onClick={() => onAction("restart")}
          >
            <RotateCw size={16} className={cx(pending === `${bot.botId}-restart` && "animate-spin")} />
          </IconButton>
          <IconButton label={`Unlink ${bot.botUsername}`} size={32} className="hover:bg-now hover:text-white" disabled={busy} onClick={onAskUnlink}>
            <Unlink size={16} />
          </IconButton>
        </div>
      </div>

      {bot.lastError ? (
        <p className="mt-3 text-[13px] leading-snug text-now">
          <span className="font-semibold">Last error:</span> {bot.lastError}
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[4px] border border-now bg-paper px-3.5 py-2.5">
          <p className="min-w-0 flex-1 text-[14px]">
            Unlink <strong>{bot.botUsername}</strong>? Bypass stops it if it&apos;s running and deletes the stored token.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" busy={pending === `${bot.botId}-delete`} onClick={onUnlink}>
              Unlink bot
            </Button>
            <Button variant="ghost" size="sm" autoFocus onClick={onCancelUnlink}>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function LinkForm({ onCancel, onLinked }: { onCancel: () => void; onLinked: (name: string) => void }) {
  const id = useId();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    setToken("");
    onCancel();
  };

  return (
    <form
      autoComplete="off"
      onSubmit={async (e) => {
        e.preventDefault();
        const value = token.trim();
        if (!value || busy) return;
        setBusy(true);
        setError(null);
        // The token leaves the field as soon as it's sent; it is never kept or shown again.
        setToken("");
        try {
          const res = await fetch("/api/user/bots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: value }),
          });
          const body = await readJson(res);
          if (!res.ok) throw new Error(body.error || "Couldn't link that bot");
          onLinked((body as { bot?: { botUsername?: string } }).bot?.botUsername ?? "your bot");
        } catch (err) {
          setError(`${err instanceof Error ? err.message : "Couldn't link that bot"}. Paste the token again to retry.`);
        } finally {
          setBusy(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") cancel();
      }}
      aria-label="Link a bot"
      className="mb-6 grid gap-4 rounded-[4px] border-2 border-ink bg-paper p-4 sm:p-5"
    >
      <div>
        <h2 className="bill text-[30px]">Link a bot</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink-2">
          Paste the token from the Bot page of your application. It&apos;s encrypted before it&apos;s stored and never shown again.
        </p>
      </div>
      <div>
        <label htmlFor={`${id}-token`} className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold">
          <KeyRound size={15} aria-hidden /> Bot token
        </label>
        <TextInput
          id={`${id}-token`}
          type="password"
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          data-bwignore
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste the bot token"
        />
        {error ? (
          <p id={`${id}-err`} role="alert" className="mt-2 text-[13px] text-now">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="ink" busy={busy} disabled={!token.trim()}>
          {busy ? "Checking with Discord…" : "Link bot"}
        </Button>
        <Button type="button" variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
