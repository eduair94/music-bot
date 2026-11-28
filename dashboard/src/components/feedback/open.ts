import type { DialogKind } from "@/lib/feedback/validate";

/**
 * Window event that opens the feedback dialog from anywhere on the page:
 *   window.dispatchEvent(new CustomEvent("bp:feedback-open", { detail: { kind: "bug" } }))
 * A mounted <FeedbackTrigger> (landing footer, dashboard top bar) hosts the dialog.
 */
export const FEEDBACK_OPEN_EVENT = "bp:feedback-open";

export interface FeedbackOpenDetail {
  kind?: DialogKind;
  /** Page path or feature the feedback is about; defaults to the current path. */
  context?: string;
}

export function openFeedback(detail: FeedbackOpenDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FeedbackOpenDetail>(FEEDBACK_OPEN_EVENT, { detail }));
}
