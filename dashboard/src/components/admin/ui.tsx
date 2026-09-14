"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type Tone = "signal" | "amber" | "clip" | "dust";

const chipTone: Record<Tone, string> = {
  signal: "text-signal border-signal/40 bg-signal/10",
  amber: "text-amber border-amber/40 bg-amber/10",
  clip: "text-clip border-clip/40 bg-clip/10",
  dust: "text-dune border-line-bright bg-panel-raised"
};

const buttonTone: Record<Tone, string> = {
  signal: "border-signal/50 text-signal hover:bg-signal/10",
  amber: "border-amber/60 text-amber hover:bg-amber/10",
  clip: "border-clip/60 text-clip hover:bg-clip/10",
  dust: "border-line-bright text-dune hover:text-cream hover:border-amber/60"
};

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`console-panel rounded-xl p-5 ${className}`}>{children}</div>;
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`console-label ${className}`}>{children}</div>;
}

export function SectionHead({
  kicker,
  title,
  note,
  action
}: {
  kicker: string;
  title: string;
  note?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-4">
        <span className="console-label text-amber!">{kicker}</span>
        <span className="flex-1 h-px bg-line" />
        {note && <span className="console-label">{note}</span>}
        {action}
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight mt-3 text-cream">{title}</h2>
    </div>
  );
}

export function Chip({ tone = "dust", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${chipTone[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  tone = "dust",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  const base =
    "px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-amber";
  return <button className={`${base} ${buttonTone[tone]} ${className}`} {...props} />;
}

export function iconUrl(id: string, icon: string | null, size = 64): string {
  if (!icon) return "";
  const fmt = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${id}/${icon}.${fmt}?size=${size}`;
}

export function Loader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="eq scale-150">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export function Unavailable({ what }: { what: string }) {
  return (
    <div className="console-panel rounded-xl p-6 text-center">
      <span className="led led--amber inline-block mr-2 align-middle" />
      <span className="font-mono text-sm text-dune">{what} unavailable</span>
    </div>
  );
}
