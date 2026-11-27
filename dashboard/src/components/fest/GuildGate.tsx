"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { isDemo } from "@/lib/dash/demo";
import { useGuildLive, type AccessProblem } from "@/lib/dash/live";
import { openInviteWindow } from "./StageInvites";
import { Button } from "./ui";

/** Loading and access states for a server; renders the page once the fleet is known. */
export function GuildGate({ children }: { children: React.ReactNode }) {
  const { fleet, error, problem, refresh } = useGuildLive();

  if (!fleet && problem?.code === "bot_missing") return <BotMissing problem={problem} />;

  if (error && !fleet) {
    return (
      <section className="mx-auto grid max-w-3xl items-center gap-8 px-4 py-16 sm:grid-cols-[1fr_16rem] sm:px-6">
        <div>
          <h1 className="bill text-[44px]">Can&apos;t open this bill</h1>
          <p className="mt-3 max-w-prose text-[15px] text-ink-2">
            {error}. You need to be a member of the server, and Bypass has to be in it. If you just added Bypass, give it a
            few seconds.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="ink" onClick={() => void refresh()}>
              Try again
            </Button>
            <Link href="/servers" className="inline-flex h-10 items-center rounded-[4px] border border-ink px-4 text-sm font-semibold hover:bg-ink hover:text-stock">
              Back to your servers
            </Link>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dash/empty-stage.webp" alt="" width={480} height={320} className="w-full" />
      </section>
    );
  }

  if (!fleet) {
    return (
      <div aria-busy="true" aria-label="Loading the bill" className="px-4 py-6 sm:px-6">
        <div className="mb-6 h-12 w-48 animate-pulse rounded-[4px] bg-ink/10" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[60vh] animate-pulse rounded-[4px] bg-ink/[0.06]" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

const backLink =
  "inline-flex h-10 items-center rounded-[4px] border border-ink px-4 text-sm font-semibold transition-colors hover:bg-ink hover:text-stock";

/**
 * Bypass isn't in the server yet. A member who can add bots gets the invite
 * (or, coming from the server list with `?setup=1`, is told to finish in the
 * Discord tab that just opened); the page checks every few seconds and opens
 * the bill, with the extra stages on offer, as soon as Bypass arrives.
 */
function BotMissing({ problem }: { problem: AccessProblem }) {
  const { guildId, refresh } = useGuildLive();
  const demo = isDemo(guildId);
  const [opened, setOpened] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const name = problem.guildName ?? "this server";
  const invite = problem.canManage ? problem.inviteUrl : null;

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("setup") === "1") setOpened(true);
  }, []);

  // Quicker than the page's own fallback polling while someone is adding Bypass.
  useEffect(() => {
    if (!opened || demo) return;
    const id = setInterval(() => void refresh(), 3000);
    const onBack = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onBack);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onBack);
    };
  }, [demo, opened, refresh]);

  const open = () => {
    if (!invite) return;
    const w = openInviteWindow(invite, 1, demo);
    setBlocked(!w);
    setOpened(true);
  };

  return (
    <section className="mx-auto grid max-w-4xl items-center gap-8 px-4 py-16 sm:grid-cols-[minmax(0,1fr)_16rem] sm:px-6">
      <div className="min-w-0">
        <h1 className="bill text-balance text-[44px] sm:text-[52px]">Bypass isn&apos;t in {name} yet</h1>
        {invite ? (
          <>
            <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-ink-2">
              {blocked
                ? "Your browser blocked the Discord window. Open it with the button below, then Authorize."
                : opened
                  ? "Finish in Discord: Continue, then Authorize. This page opens the bill as soon as Bypass arrives, and offers the extra stages next."
                  : `Add it to run the player, the queue and the permissions for ${name} from here. This page opens the bill as soon as it arrives.`}
            </p>
            {opened && !blocked ? (
              <p aria-live="polite" className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                <span aria-hidden className="now-dot h-2 w-2 rounded-full bg-ink" />
                Waiting for Bypass to join
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-2">
              {blocked ? (
                <a
                  href={invite}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    if (demo) e.preventDefault();
                    setBlocked(false);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-[4px] bg-ink px-4 text-sm font-semibold text-stock transition-colors hover:bg-ink-2"
                >
                  Open Discord <ArrowUpRight size={15} aria-hidden />
                </a>
              ) : (
                <Button variant={opened ? "outline" : "ink"} onClick={open}>
                  {opened ? "Open Discord again" : `Add Bypass to ${name}`} <ArrowUpRight size={15} aria-hidden />
                </Button>
              )}
              <Link href="/servers" className={backLink}>
                Back to your servers
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-ink-2">
              Adding a bot needs the Manage Server permission in {name}. Once someone who has it adds Bypass, this bill opens
              here.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="ink" onClick={() => void refresh()}>
                Check again
              </Button>
              <Link href="/servers" className={backLink}>
                Back to your servers
              </Link>
            </div>
          </>
        )}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/dash/empty-stage.webp" alt="" width={480} height={320} className="w-full" />
    </section>
  );
}
