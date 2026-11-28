/**
 * Forwards a piece of feedback to the staff channel in the support server
 * through a Discord webhook (env FEEDBACK_WEBHOOK_URL). Used by the bot's
 * /feedback command and by the dashboard's POST /api/public/feedback.
 *
 * fetch-based, 4 s timeout, never throws: feedback is stored in Mongo first,
 * the channel post is a convenience. `allowed_mentions: { parse: [] }` keeps
 * the post from pinging anyone, whatever the message contains.
 */
import { FEEDBACK_CONTACT_MAX, type FeedbackKind, type FeedbackRecord } from "./growth";

export type FeedbackWebhookInput = Omit<FeedbackRecord, "status" | "createdAt"> & { createdAt?: Date };

export const FEEDBACK_WEBHOOK_TIMEOUT_MS = 4000;

const KIND_LABEL: Record<FeedbackKind, string> = {
  idea: "Idea",
  bug: "Bug report",
  praise: "Praise",
  other: "Feedback",
  nps: "NPS answer"
};

const KIND_COLOR: Record<Exclude<FeedbackKind, "nps">, number> = {
  idea: 0xf8aa2a,
  bug: 0xff5a48,
  praise: 0x5be49b,
  other: 0x8f8478
};

/** NPS bands: 9-10 promoter, 7-8 passive, 0-6 detractor. */
export function npsBand(score: number): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

const NPS_COLOR = { promoter: 0x5be49b, passive: 0xf8aa2a, detractor: 0xff5a48 } as const;

/** Embed descriptions hold 4096 characters; the message is capped well below that. */
const MESSAGE_PREVIEW_MAX = 1800;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Inline code that can't be broken out of (no backticks, one line). */
function code(text: string, max = 200): string {
  const clean = text.replace(/`/g, "'").replace(/\s+/g, " ").trim();
  return clean ? `\`${truncate(clean, max)}\`` : "—";
}

const SNOWFLAKE = /^\d{17,20}$/;

/** Discord webhook body for one piece of feedback. Pure, exported for tests. */
export function buildFeedbackWebhookPayload(fb: FeedbackWebhookInput) {
  const hasScore = typeof fb.score === "number" && Number.isFinite(fb.score);
  const isNps = fb.kind === "nps" && hasScore;
  const band = isNps ? npsBand(fb.score as number) : null;
  const title = isNps ? `NPS ${fb.score}/10 (${band})` : KIND_LABEL[fb.kind] ?? "Feedback";
  const color = band ? NPS_COLOR[band] : KIND_COLOR[fb.kind as Exclude<FeedbackKind, "nps">] ?? KIND_COLOR.other;

  const message = (fb.message ?? "").trim();
  const fields: { name: string; value: string; inline?: boolean }[] = [];
  fields.push({ name: "Source", value: fb.context ? `${fb.source} · ${code(fb.context, 120)}` : fb.source, inline: true });
  if (hasScore && !isNps) fields.push({ name: "Score", value: String(fb.score), inline: true });
  if (fb.userId && SNOWFLAKE.test(fb.userId)) {
    const name = fb.userName ? ` ${code(fb.userName, 64)}` : "";
    fields.push({ name: "User", value: `<@${fb.userId}>${name}`, inline: true });
  }
  if (fb.contact) fields.push({ name: "Reply to", value: code(fb.contact, FEEDBACK_CONTACT_MAX), inline: true });
  if (fb.guildId && SNOWFLAKE.test(fb.guildId)) fields.push({ name: "Server", value: code(fb.guildId), inline: true });
  const where = [fb.country, fb.locale].filter(Boolean).join(" · ");
  if (where) fields.push({ name: "Country · locale", value: code(where, 40), inline: true });
  if (fb.quoteOk) fields.push({ name: "Quote", value: "May be quoted on the site", inline: true });

  return {
    username: "Bypass feedback",
    allowed_mentions: { parse: [] as string[] },
    embeds: [
      {
        title,
        description: message ? truncate(message, MESSAGE_PREVIEW_MAX) : "*(no message)*",
        color,
        fields,
        timestamp: (fb.createdAt ?? new Date()).toISOString()
      }
    ]
  };
}

/** Only real https URLs are posted to. */
function usableUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Posts the feedback to the staff channel. Resolves true when Discord
 * accepted it, false when no webhook is configured, it timed out, or failed.
 */
export async function forwardFeedback(
  fb: FeedbackWebhookInput,
  options: { url?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<boolean> {
  const url = usableUrl(options.url ?? process.env.FEEDBACK_WEBHOOK_URL);
  if (!url) return false;
  const doFetch = options.fetchImpl ?? (typeof fetch === "function" ? fetch : null);
  if (!doFetch) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? FEEDBACK_WEBHOOK_TIMEOUT_MS);
  (timer as { unref?: () => void }).unref?.();
  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildFeedbackWebhookPayload(fb)),
      signal: controller.signal
    });
    if (!res.ok) console.warn(`[feedback] webhook answered HTTP ${res.status}`);
    return res.ok;
  } catch (error) {
    console.warn("[feedback] webhook failed:", (error as Error)?.name === "AbortError" ? "timed out" : (error as Error)?.message ?? error);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
