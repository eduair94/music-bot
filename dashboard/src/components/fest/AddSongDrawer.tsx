"use client";

/**
 * "Add to the bill": search or paste a link, pick the stage (bot) and, for an
 * idle bot, the voice channel it should open in. Opens from the top-bar search,
 * the "/" key, or any "fest:add-song" event (detail.instance preselects a stage).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link2, Loader2, Plus, Search, X } from "lucide-react";
import { useGuildMeta } from "@/lib/dash/hooks";
import { useGuildLive } from "@/lib/dash/live";
import { stage } from "@/lib/dash/stages";
import type { Track } from "@/lib/dash/types";
import { useToast } from "./Toast";
import { Button, cx, Select } from "./ui";

const URL_RE = /^https?:\/\//i;

export function AddSongDrawer() {
  const { fleet, me, send } = useGuildLive();
  const { data: meta } = useGuildMeta();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [instance, setInstance] = useState<number | null>(null);
  const [channel, setChannel] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqSeq = useRef(0);

  const stages = useMemo(() => (fleet?.instances ?? []).filter((i) => i.inGuild && i.online), [fleet]);

  const defaultInstance = useCallback(() => {
    const mine = stages.find((s) => s.playback?.voiceChannelId && s.playback.voiceChannelId === me?.voiceChannelId);
    return (mine ?? stages.find((s) => s.playback?.currentTrack) ?? stages[0])?.instance ?? 1;
  }, [stages, me]);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ instance?: number }>).detail;
      setInstance(detail?.instance ?? defaultInstance());
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable;
      if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setInstance(defaultInstance());
        setOpen(true);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("fest:add-song", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("fest:add-song", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [defaultInstance, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  const target = stages.find((s) => s.instance === instance) ?? null;
  const idle = !target?.playback?.isConnected;

  useEffect(() => {
    if (!target) return;
    setChannel(target.playback?.voiceChannelId ?? me?.voiceChannelId ?? target.binding.voiceChannelId ?? meta?.voiceChannels[0]?.id ?? "");
  }, [target?.instance, target, me?.voiceChannelId, meta?.voiceChannels]);

  // Debounced search through the bot.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2 || URL_RE.test(q) || !instance) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const seq = ++reqSeq.current;
    setSearching(true);
    const id = setTimeout(async () => {
      const r = await send(instance, "search", { query: q });
      if (seq !== reqSeq.current) return;
      setSearching(false);
      if (!r.success) {
        setSearchError(r.reason || r.error || "Search failed");
        setResults([]);
      } else {
        setSearchError(null);
        setResults(r.data?.results ?? []);
      }
    }, 350);
    return () => clearTimeout(id);
  }, [query, open, instance, send]);

  const add = async (q: string, label: string, track?: Track) => {
    if (!instance) return;
    setAdding(label);
    const vc = meta?.voiceChannels.find((v) => v.id === channel);
    const r = await send(instance, "play", { query: q, voiceChannelId: idle ? channel : undefined, voiceChannelName: vc?.name, track });
    setAdding(null);
    const s = stage(instance);
    if (r.success) {
      toast.push({ title: `${label} → ${target?.name ?? "Bypass"}`, detail: idle && vc ? `Opening in ${vc.name}` : r.message, color: s.color });
      if (URL_RE.test(q)) setQuery("");
    } else {
      toast.push({ tone: "error", title: "Couldn't add that song", detail: r.reason || r.error });
    }
  };

  if (!open) return null;
  const s = stage(instance ?? 1);
  const isUrl = URL_RE.test(query.trim());

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Add to the bill">
      <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/35 animate-[stub-in_200ms_ease-out]" />
      <aside
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[6px] border-t border-ink bg-stock shadow-[0_-12px_40px_-16px_rgb(21_21_21/0.45)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[min(30rem,100vw)] sm:rounded-none sm:border-l sm:border-t-0 sm:shadow-[-16px_0_40px_-20px_rgb(21_21_21/0.45)]"
        style={{ animation: "stub-in 320ms cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div className="flex items-center gap-3 border-b border-rule px-5 py-4" style={{ boxShadow: `inset 0 6px 0 ${s.color}` }}>
          <h2 className="bill text-[30px]">Add to the bill</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto rounded-[4px] p-2 hover:bg-ink/[0.07]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-ink-2">Stage</legend>
            <div className="flex flex-wrap gap-2">
              {stages.map((st) => {
                const c = stage(st.instance);
                const active = st.instance === instance;
                return (
                  <button
                    key={st.instance}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setInstance(st.instance)}
                    className={cx(
                      "flex items-center gap-2 rounded-[4px] border px-3 py-2 text-left text-sm transition-colors",
                      active ? "border-ink bg-ink text-stock" : "border-ink/25 hover:border-ink",
                    )}
                  >
                    <span aria-hidden className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: c.color }} />
                    <span className="font-semibold">{st.name}</span>
                    <span className={cx("text-xs", active ? "text-stock/70" : "text-ink-3")}>
                      {st.playback?.isConnected ? st.playback.voiceChannelName : "idle"}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {idle ? (
            <div>
              <label htmlFor="add-vc" className="mb-2 block text-[13px] font-semibold text-ink-2">
                Opens in voice channel
              </label>
              <Select id="add-vc" value={channel} onChange={(e) => setChannel(e.target.value)}>
                {(meta?.voiceChannels ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.parentName ? `${v.parentName} / ` : ""}
                    {v.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = query.trim();
              if (!q) return;
              if (isUrl) void add(q, "Link");
              else if (results[0]) void add(`${results[0].url}`, results[0].title, results[0]);
              else void add(q, q);
            }}
            className="relative"
          >
            {isUrl ? <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2" /> : <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2" />}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Song, artist, or a YouTube / Spotify / SoundCloud link"
              aria-label="Search songs or paste a link"
              className="h-12 w-full rounded-[4px] border-2 border-ink bg-paper pl-9 pr-24 text-[15px] placeholder:text-ink-3 focus:outline-none"
            />
            <Button type="submit" variant="ink" size="sm" className="absolute right-2 top-1/2 -translate-y-1/2" disabled={!query.trim() || Boolean(adding)}>
              {isUrl ? "Add link" : "Add"}
            </Button>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-rule">
          {searching ? (
            <p className="flex items-center gap-2 px-5 py-4 text-sm text-ink-2">
              <Loader2 size={16} className="animate-spin" /> Searching…
            </p>
          ) : searchError ? (
            <p className="px-5 py-4 text-sm text-now">{searchError}</p>
          ) : results.length > 0 ? (
            <ul>
              {results.map((r, i) => (
                <li key={`${r.url}-${i}`} className="flex items-center gap-3 border-b border-rule px-5 py-2.5 last:border-b-0" style={{ animation: `stub-in 300ms cubic-bezier(0.16,1,0.3,1) ${i * 30}ms both` }}>
                  {r.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnail} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-[3px] object-cover" />
                  ) : (
                    <span aria-hidden className="h-11 w-11 shrink-0 rounded-[3px]" style={{ background: s.tint }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{r.title}</p>
                    <p className="truncate text-[13px] text-ink-2">
                      {r.author} · <span className="tabular-nums">{r.duration}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void add(r.url && r.url !== "#" ? r.url : `${r.title} ${r.author}`, r.title, r)}
                    busy={adding === r.title}
                    aria-label={`Add ${r.title}`}
                  >
                    <Plus size={14} /> Add
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-8 py-10 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/dash/setlist.webp" alt="" width={160} height={160} className="h-36 w-36 -rotate-3 object-contain" />
              <p className="mt-3 max-w-xs text-sm text-ink-2">
                Type at least two letters to search, or paste a link. Press <kbd className="rounded-[3px] border border-ink/25 px-1">Enter</kbd> to add the first result.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
