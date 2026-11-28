/**
 * Server-side analytics identity: a salted, truncated SHA-256 of the Discord
 * id. Stable per user (so GA/Clarity join a person's devices), but neither
 * tool ever sees the raw id, a name or an email.
 */

import { createHash } from "node:crypto";

export function analyticsUserHash(discordId: string | null | undefined): string | null {
  if (!discordId) return null;
  const salt = process.env.ANALYTICS_SALT || "bypass-analytics";
  return createHash("sha256").update(salt + discordId).digest("hex").slice(0, 16);
}
