/**
 * Client-side mirror of the bot's permission gate, used by "Check a member"
 * so anyone can see why an action is allowed or blocked. Order of rules:
 *   1. admins always pass
 *   2. deny lists (member, then role) beat everything below
 *   3. allow lists (member, then role)
 *   4. the wristband: everyone → yes; DJs → a DJ role; admins → no
 * Notes list the house rules that can still let a blocked member act.
 */
import type { Group, PermissionConfig } from "@/lib/dash/types";

export interface Subject {
  /** Role ids the member holds (without @everyone). */
  roles: string[];
  userId?: string;
  /** Manage Server or the admin role. */
  isAdmin?: boolean;
}

export type RuleSource = "admin" | "deny-user" | "deny-role" | "allow-user" | "allow-role" | "everyone" | "dj-role" | "dj-only" | "admins-only";

export interface Verdict {
  ok: boolean;
  source: RuleSource;
  /** The rule that decided it, in plain words. */
  rule: string;
  /** House rules that still let a blocked member act ("unless …"). */
  notes: string[];
}

/** The "alone with the bot" house rule, as it appears in `notes`. */
export const NOTE_ALONE = "they're alone with the bot";

export function evaluate(
  config: PermissionConfig,
  group: Group,
  subject: Subject,
  roleName: (id: string) => string = (id) => id,
): Verdict {
  const rule = config.groups[group];
  const at = (id: string) => `@${roleName(id)}`;
  const pass = (source: RuleSource, text: string): Verdict => ({ ok: true, source, rule: text, notes: [] });
  const block = (source: RuleSource, text: string, notes: string[] = []): Verdict => ({ ok: false, source, rule: text, notes });

  if (subject.isAdmin) return pass("admin", "Admins always pass");

  if (subject.userId && rule.denyUsers.includes(subject.userId)) return block("deny-user", "This member is on the deny list");
  const deniedRole = subject.roles.find((r) => rule.denyRoles.includes(r));
  if (deniedRole) return block("deny-role", `${at(deniedRole)} is on the deny list`);

  if (subject.userId && rule.allowUsers.includes(subject.userId)) return pass("allow-user", "This member is on the allow list");
  const allowedRole = subject.roles.find((r) => rule.allowRoles.includes(r));
  if (allowedRole) return pass("allow-role", `${at(allowedRole)} is on the allow list`);

  if (rule.mode === "everyone") return pass("everyone", "Open to everyone");

  const notes: string[] = [];
  const o = config.options;
  if (o.requesterCanSkipOwn && group === "skip") notes.push("it's their own song");
  if (o.requesterCanSkipOwn && group === "queue") notes.push("it's their own song");
  if (o.voteSkip.enabled && group === "skip") notes.push(`${o.voteSkip.percentage}% of listeners vote to skip`);

  if (rule.mode === "dj") {
    const djRole = subject.roles.find((r) => config.djRoles.includes(r));
    if (djRole) return pass("dj-role", `${at(djRole)} is a DJ role`);
    if (o.aloneIsDj) notes.unshift(NOTE_ALONE);
    const why = subject.roles.length === 0 ? "DJs only; no DJ role" : `DJs only; ${subject.roles.map(at).join(", ")} isn't a DJ role`;
    return block("dj-only", config.djRoles.length ? why : "DJs only, and no DJ role is set", notes);
  }

  return block("admins-only", "Admins only", notes);
}
