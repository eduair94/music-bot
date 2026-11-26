import { createHmac, timingSafeEqual } from "crypto";

/**
 * Vote webhook parsing for bot listing sites. Pure functions (no I/O) so they
 * can be unit tested; the route stores the result.
 *
 * Auth per site (checked 2026-11-26):
 *  - top.gg v1: `x-topgg-signature: t=<unix>,v1=<hex>` = HMAC-SHA256(secret, `${t}.${rawBody}`),
 *    rejected when older than 5 minutes. Legacy v0: `Authorization: <secret>`.
 *  - discordbotlist.com, discords.com, botlist.me, voidbots.net, discord.place:
 *    `Authorization: <secret>`.
 */
export const VOTE_PERK_HOURS = 12;

export interface ParsedVote {
  userId: string;
  votedAt: Date;
  perksUntil: Date;
  isWeekend: boolean;
  test: boolean;
}

export const SITE_SECRETS: Record<string, string> = {
  topgg: "TOPGG_WEBHOOK_SECRET",
  discordbotlist: "DISCORDBOTLIST_WEBHOOK_SECRET",
  discords: "DISCORDS_WEBHOOK_SECRET",
  botlistme: "BOTLISTME_WEBHOOK_SECRET",
  voidbots: "VOIDBOTS_WEBHOOK_SECRET",
  discordplace: "DISCORDPLACE_WEBHOOK_SECRET",
};

export const SITE_LABELS: Record<string, string> = {
  topgg: "top.gg",
  discordbotlist: "discordbotlist.com",
  discords: "discords.com",
  botlistme: "botlist.me",
  voidbots: "voidbots.net",
  discordplace: "discord.place",
};

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Verify top.gg's v1 signature header. */
export function verifyTopggSignature(header: string, rawBody: string, secret: string, now = Date.now()): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [k, ...v] = part.trim().split("=");
      return [k, v.join("=")];
    })
  );
  const t = Number(parts.t);
  if (!parts.v1 || !Number.isFinite(t)) return false;
  if (Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  return safeEqual(expected, parts.v1);
}

export type AuthResult = "ok" | "unauthorized";

export function authorize(site: string, headers: Headers, rawBody: string, secret: string): AuthResult {
  if (site === "topgg") {
    const signature = headers.get("x-topgg-signature");
    if (signature) return verifyTopggSignature(signature, rawBody, secret) ? "ok" : "unauthorized";
  }
  const auth = headers.get("authorization") ?? "";
  return auth && safeEqual(auth.replace(/^Bearer\s+/i, ""), secret) ? "ok" : "unauthorized";
}

const isSnowflake = (value: unknown): value is string => typeof value === "string" && /^\d{15,22}$/.test(value);

/** Extract the voter from a site's payload; null when it isn't a usable vote. */
export function parseVote(site: string, body: any, now = new Date()): ParsedVote | null {
  const window = (from: Date, until?: Date | null) => ({
    votedAt: from,
    perksUntil: until && until > from ? until : new Date(from.getTime() + VOTE_PERK_HOURS * 3600_000),
  });

  if (site === "topgg") {
    // v1
    if (typeof body?.type === "string" && body.type.includes(".")) {
      const test = body.type === "webhook.test";
      const userId = body?.data?.user?.platform_id;
      if (!isSnowflake(userId)) return null;
      const created = body.data.created_at ? new Date(body.data.created_at) : now;
      const expires = body.data.expires_at ? new Date(body.data.expires_at) : null;
      return { userId, ...window(created, expires), isWeekend: Number(body.data.weight) > 1, test };
    }
    // v0
    if (!isSnowflake(body?.user)) return null;
    return { userId: body.user, ...window(now), isWeekend: Boolean(body.isWeekend), test: body.type === "test" };
  }

  const userId = site === "discordbotlist" ? body?.id : body?.user;
  if (!isSnowflake(userId)) return null;
  const type = String(body?.type ?? "").toLowerCase();
  if (site === "discords" && type === "review") return null;
  const test = type === "test" || body?.test === true;
  return { userId, ...window(now), isWeekend: false, test };
}
