"use client";

/**
 * "Send feedback" button + the page's dialog host. The dialog code is a
 * separate chunk, fetched on hover/focus of a trigger or on the first
 * `bp:feedback-open` event, so static pages only ship this small file.
 */
import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { FEEDBACK_OPEN_EVENT, openFeedback, type FeedbackOpenDetail } from "./open";

export type FeedbackSkin = "studio" | "fest";

const loadDialog = () => import("./FeedbackDialog");
const FeedbackDialog = dynamic(loadDialog, { ssr: false });

/** Mounted hosts, oldest first; only the oldest answers the event, so one dialog opens. */
const hosts: symbol[] = [];

export function FeedbackHost({ skin }: { skin: FeedbackSkin }) {
  const [request, setRequest] = useState<(FeedbackOpenDetail & { open: boolean; seq: number }) | null>(null);

  useEffect(() => {
    const me = Symbol("feedback-host");
    hosts.push(me);
    const onOpen = (event: Event) => {
      if (hosts[0] !== me) return;
      const detail = (event as CustomEvent<FeedbackOpenDetail | null>).detail ?? {};
      setRequest((prev) => ({ ...detail, open: true, seq: (prev?.seq ?? 0) + 1 }));
    };
    window.addEventListener(FEEDBACK_OPEN_EVENT, onOpen);
    return () => {
      hosts.splice(hosts.indexOf(me), 1);
      window.removeEventListener(FEEDBACK_OPEN_EVENT, onOpen);
    };
  }, []);

  if (!request) return null;
  return (
    <FeedbackDialog
      skin={skin}
      open={request.open}
      seq={request.seq}
      kind={request.kind}
      context={request.context}
      onClose={() => setRequest((prev) => (prev ? { ...prev, open: false } : prev))}
    />
  );
}

export default function FeedbackTrigger({
  skin,
  className,
  children,
  kind,
  context,
  label,
}: {
  skin: FeedbackSkin;
  className?: string;
  children?: ReactNode;
  kind?: FeedbackOpenDetail["kind"];
  context?: string;
  /** Accessible name when the visible content is an icon or shortened. */
  label?: string;
}) {
  const preload = () => void loadDialog();
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={label}
        title={label}
        className={`cursor-pointer ${className ?? ""}`}
        onPointerEnter={preload}
        onFocus={preload}
        onClick={() => openFeedback({ kind, context })}
      >
        {children ?? "Send feedback"}
      </button>
      <FeedbackHost skin={skin} />
    </>
  );
}
