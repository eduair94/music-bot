"use client";

/**
 * Collections as setlists: each saved playlist is a sheet on the bill with
 * its songs in running order. Same API calls and behaviour as before
 * (hooks/useCollections): create, edit, make public (share code), delete,
 * remove songs. Edits happen in place; nothing opens a modal.
 */
import { ChevronRight, Globe, Link2, Lock, Music2, Pencil, Plus, RotateCw, Trash2, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useCollections, type Collection, type CollectionTrack } from "@/hooks/useCollections";
import { useToast } from "../Toast";
import { Button, cx, IconButton, Switch, TextInput } from "../ui";
import { useDemoCollections } from "./demoCollections";
import { PageHead } from "./PageHead";

type Api = Pick<
  ReturnType<typeof useCollections>,
  "collections" | "loading" | "error" | "refresh" | "createCollection" | "updateCollection" | "deleteCollection" | "removeTracks"
>;

export function CollectionsScreen({ demo }: { demo: boolean }) {
  return demo ? <DemoSetlists /> : <LiveSetlists />;
}

function LiveSetlists() {
  return <SetlistsView api={useCollections()} />;
}

function DemoSetlists() {
  return <SetlistsView api={useDemoCollections()} />;
}

function fmtSecs(seconds: number): string {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function fmtTotal(tracks: CollectionTrack[]): string {
  const total = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const Cmd = ({ children }: { children: React.ReactNode }) => <code className="[font-family:inherit] font-semibold text-ink">{children}</code>;

interface FormValues {
  name: string;
  description?: string;
  isPublic: boolean;
}

function SetlistsView({ api }: { api: Api }) {
  const { collections, loading, error, refresh, createCollection, updateCollection, deleteCollection, removeTracks } = api;
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [fresh, setFresh] = useState<string | null>(null);
  const acted = useRef(false);

  const loadFailed = Boolean(error) && !loading && collections.length === 0 && !acted.current;
  const songs = collections.reduce((n, c) => n + c.tracks.length, 0);

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = async (v: FormValues) => {
    acted.current = true;
    const c = await createCollection(v.name, v.description, v.isPublic);
    if (!c) {
      toast.push({ tone: "error", title: "Couldn't create that setlist", detail: "Check your connection and try again." });
      return false;
    }
    setCreating(false);
    setFresh(c._id);
    setOpen((s) => new Set(s).add(c._id));
    toast.push({ title: `${c.name} is ready`, detail: "Fill it from Discord with /collections save." });
    return true;
  };

  const save = async (c: Collection, v: FormValues) => {
    acted.current = true;
    const ok = await updateCollection(c._id, { name: v.name, description: v.description, isPublic: v.isPublic });
    if (!ok) {
      toast.push({ tone: "error", title: "Couldn't save your changes", detail: "Nothing was changed. Try again in a moment." });
      return false;
    }
    setEditing(null);
    toast.push({ title: "Setlist updated" });
    return true;
  };

  const remove = async (c: Collection) => {
    acted.current = true;
    setDeleting(true);
    const ok = await deleteCollection(c._id);
    setDeleting(false);
    if (!ok) {
      toast.push({ tone: "error", title: `Couldn't delete ${c.name}`, detail: "It's still there. Try again in a moment." });
      return;
    }
    setConfirming(null);
    toast.push({ title: `Deleted ${c.name}` });
  };

  const dropTrack = async (c: Collection, index: number) => {
    acted.current = true;
    const title = c.tracks[index]?.title ?? "that song";
    const ok = await removeTracks(c._id, [index]);
    if (!ok) toast.push({ tone: "error", title: `Couldn't remove ${title}`, detail: "Try again in a moment." });
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.push({ title: "Share code copied", detail: `Others add it with /collections clone ${code}` });
    } catch {
      toast.push({ tone: "error", title: "Couldn't copy", detail: `The share code is ${code}` });
    }
  };

  const status = loading ? (
    "Loading your setlists…"
  ) : loadFailed ? (
    "Couldn't load your setlists"
  ) : (
    <>
      {plural(collections.length, "setlist", "setlists")} · {plural(songs, "song", "songs")} · load one in Discord with{" "}
      <Cmd>/collections load</Cmd>
    </>
  );

  return (
    <>
      <PageHead
        title="Collections"
        status={status}
        actions={
          <Button
            variant="ink"
            size="sm"
            disabled={loading || creating}
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
          >
            <Plus size={14} /> New setlist
          </Button>
        }
      />

      <div className="px-4 pb-24 pt-6 sm:px-6">
        <div className="max-w-5xl">
          {creating ? <SetlistForm submitLabel="Create setlist" onSubmit={create} onCancel={() => setCreating(false)} /> : null}

          {loading ? (
            <div aria-busy="true" aria-label="Loading setlists">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 border-t-2 border-ink/15 py-4">
                  <div className="h-7 w-56 animate-pulse rounded-[3px] bg-ink/10" style={{ animationDelay: `${i * 120}ms` }} />
                  <div className="h-4 w-24 animate-pulse rounded-[3px] bg-ink/[0.07]" style={{ animationDelay: `${i * 120}ms` }} />
                </div>
              ))}
            </div>
          ) : loadFailed ? (
            <section className="py-6">
              <h2 className="bill text-[40px]">Couldn&apos;t load your setlists</h2>
              <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">
                {error}. Your setlists are safe; this page just couldn&apos;t reach them. Try again in a few seconds.
              </p>
              <Button variant="ink" className="mt-5" onClick={() => void refresh()}>
                <RotateCw size={16} /> Try again
              </Button>
            </section>
          ) : collections.length === 0 && !creating ? (
            <section className="grid items-center gap-6 py-6 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/dash/setlist.webp" alt="" width={640} height={640} className="w-44 -rotate-2 sm:w-full" />
              <div>
                <h2 className="bill text-[40px]">No setlists yet</h2>
                <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-ink-2">
                  Save what&apos;s playing in Discord with <Cmd>/collections save</Cmd>, or bring a Spotify, YouTube or Deezer
                  playlist over with <Cmd>/collections import</Cmd>. You can also start an empty one here.
                </p>
                <Button variant="ink" className="mt-5" onClick={() => setCreating(true)}>
                  <Plus size={16} /> New setlist
                </Button>
              </div>
            </section>
          ) : (
            <ul className="border-b border-rule">
              {collections.map((c) => (
                <li key={c._id} className={cx("border-t-2 border-ink", c._id === fresh && "print-pull")}>
                  <div className="flex items-center gap-2 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(c._id)}
                      aria-expanded={open.has(c._id)}
                      aria-controls={`set-${c._id}`}
                      className="group flex min-w-0 flex-1 items-center gap-3 rounded-[4px] py-2 pr-2 text-left"
                    >
                      <ChevronRight
                        size={20}
                        aria-hidden
                        className={cx("shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]", open.has(c._id) && "rotate-90")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="bill block truncate text-[30px] leading-[0.95] decoration-2 underline-offset-4 group-hover:underline">
                          {c.name}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] font-semibold text-ink-2">
                          <span className="clock text-[15px]">
                            {plural(c.tracks.length, "song", "songs")} · {fmtTotal(c.tracks)}
                          </span>
                          <span className="flex items-center gap-1">
                            {c.isPublic ? <Globe size={13} aria-hidden /> : <Lock size={13} aria-hidden />}
                            {c.isPublic ? "Public" : "Private"}
                          </span>
                        </span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {c.shareCode ? (
                        <IconButton label="Copy share code" className="hover:bg-ink/[0.07]" onClick={() => void copyCode(c.shareCode!)}>
                          <Link2 size={17} />
                        </IconButton>
                      ) : null}
                      <IconButton
                        label={`Edit ${c.name}`}
                        className="hover:bg-ink/[0.07]"
                        aria-pressed={editing === c._id}
                        onClick={() => {
                          setEditing(editing === c._id ? null : c._id);
                          setConfirming(null);
                          setCreating(false);
                        }}
                      >
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton
                        label={`Delete ${c.name}`}
                        className="hover:bg-now hover:text-white"
                        onClick={() => {
                          setConfirming(c._id);
                          setEditing(null);
                        }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </div>

                  {confirming === c._id ? (
                    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[4px] border border-now bg-paper px-3.5 py-2.5">
                      <p className="min-w-0 flex-1 text-[14px] text-ink">
                        Delete <strong>{c.name}</strong>
                        {c.tracks.length ? ` and its ${plural(c.tracks.length, "song", "songs")}` : ""}? This can&apos;t be undone.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="danger" size="sm" busy={deleting} onClick={() => void remove(c)}>
                          Delete setlist
                        </Button>
                        <Button variant="ghost" size="sm" autoFocus onClick={() => setConfirming(null)}>
                          Keep it
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {editing === c._id ? (
                    <SetlistForm initial={c} submitLabel="Save changes" onSubmit={(v) => save(c, v)} onCancel={() => setEditing(null)} />
                  ) : null}

                  {open.has(c._id) ? (
                    <div id={`set-${c._id}`} className="pb-5 pl-8">
                      {c.description || c.shareCode ? (
                        <div className="mb-3 space-y-1 text-[14px] text-ink-2">
                          {c.description ? <p className="max-w-[65ch]">{c.description}</p> : null}
                          {c.shareCode ? (
                            <p>
                              Share code <span className="clock text-[15px] text-ink">{c.shareCode}</span>. Others copy it with{" "}
                              <Cmd>/collections clone</Cmd>.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {c.tracks.length === 0 ? (
                        <p className="rounded-[4px] border-[1.5px] border-dashed border-ink/35 px-4 py-3 text-[14px] text-ink-2">
                          No songs yet. Play something in Discord, then run <Cmd>/collections save</Cmd> with this name to fill it
                          from the queue.
                        </p>
                      ) : (
                        <ol className="border-t border-rule" aria-label={`Songs in ${c.name}`}>
                          {c.tracks.map((t, i) => (
                            <TrackRow key={`${t.url}-${i}`} track={t} position={i + 1} onRemove={() => dropTrack(c, i)} />
                          ))}
                        </ol>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function TrackRow({ track, position, onRemove }: { track: CollectionTrack; position: number; onRemove: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <li className={cx("flex items-center gap-3 border-b border-rule py-2 transition-opacity", busy && "opacity-40")}>
      <span className="clock w-7 shrink-0 text-right text-[15px] text-ink-3">{position}</span>
      {track.thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.thumbnail} alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-[3px] object-cover" />
      ) : (
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] bg-ink/[0.06] text-ink-3">
          <Music2 size={16} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{track.title}</span>
        <span className="block truncate text-[13px] text-ink-2">{track.author}</span>
      </span>
      <span className="clock shrink-0 text-[15px] text-ink-2">{fmtSecs(track.duration)}</span>
      <IconButton
        label={`Remove ${track.title}`}
        size={32}
        disabled={busy}
        className="hover:bg-ink/[0.07]"
        onClick={async () => {
          setBusy(true);
          await onRemove();
          setBusy(false);
        }}
      >
        <X size={16} />
      </IconButton>
    </li>
  );
}

function SetlistForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Collection;
  submitLabel: string;
  onSubmit: (v: FormValues) => Promise<boolean>;
  onCancel: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);
  const [busy, setBusy] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        setBusy(true);
        await onSubmit({ name: name.trim(), description: description.trim() || undefined, isPublic });
        setBusy(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      aria-label={initial ? `Edit ${initial.name}` : "New setlist"}
      className="mb-5 grid gap-4 rounded-[4px] border-2 border-ink bg-paper p-4 sm:p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${id}-name`} className="mb-1.5 block text-[14px] font-semibold">
            Name
          </label>
          <TextInput id={`${id}-name`} autoFocus required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Late night drive" />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-desc`} className="mb-1.5 block text-[14px] font-semibold">
            Description <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <TextInput id={`${id}-desc`} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-rule pt-4">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">Public</p>
          <p className="text-[13px] leading-snug text-ink-3">
            Public setlists get a share code. Others copy them with <code className="[font-family:inherit] font-semibold">/collections clone</code>.
          </p>
        </div>
        <Switch checked={isPublic} onChange={setIsPublic} label="Public setlist" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="ink" busy={busy} disabled={!name.trim()}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
