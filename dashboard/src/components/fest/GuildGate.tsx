"use client";

import Link from "next/link";
import { useGuildLive } from "@/lib/dash/live";
import { Button } from "./ui";

/** Loading and access states for a server; renders the page once the fleet is known. */
export function GuildGate({ children }: { children: React.ReactNode }) {
  const { fleet, error, refresh } = useGuildLive();

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
