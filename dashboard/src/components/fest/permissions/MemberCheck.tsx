"use client";

/**
 * "Check a member": pick a role and read, for every action, whether it is
 * allowed and the rule that decided it. Uses the rules on screen (including
 * unsaved changes); "You" shows the server's own answer for the signed-in
 * member.
 */
import { useId, useMemo } from "react";
import { Check, X } from "lucide-react";
import { GROUPS } from "@/lib/dash/types";
import type { Group, GuildRole, Me, PermissionConfig } from "@/lib/dash/types";
import { cx, Select } from "../ui";
import { evaluate, NOTE_ALONE } from "./evaluate";
import type { Verdict } from "./evaluate";
import { GROUP_INFO } from "./model";

export type CheckSubject = "me" | "everyone" | "admin" | `role:${string}`;

export function MemberCheck({
  config,
  roles,
  roleById,
  me,
  dirty,
  subject,
  onSubject,
}: {
  config: PermissionConfig;
  roles: GuildRole[];
  roleById: Map<string, GuildRole>;
  me: Me | null;
  dirty: boolean;
  subject: CheckSubject;
  onSubject: (s: CheckSubject) => void;
}) {
  const selectId = useId();
  const roleName = (id: string) => roleById.get(id)?.name ?? "deleted role";

  const verdicts = useMemo(() => {
    const out = {} as Record<Group, Verdict>;
    for (const g of GROUPS) {
      if (subject === "me" && me) {
        const v = me.groups[g];
        out[g] = {
          ok: v?.ok ?? false,
          source: me.isAdmin ? "admin" : v?.ok ? "everyone" : "dj-only",
          rule: me.isAdmin ? "Admins always pass" : v?.reason || (v?.ok ? "Allowed by the saved rules" : "Not allowed by the saved rules"),
          notes: [],
        };
      } else if (subject === "admin") {
        out[g] = evaluate(config, g, { roles: [], isAdmin: true }, roleName);
      } else if (subject.startsWith("role:")) {
        out[g] = evaluate(config, g, { roles: [subject.slice(5)] }, roleName);
      } else {
        out[g] = evaluate(config, g, { roles: [] }, roleName);
      }
    }
    return out;
    // roleName is derived from roleById
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, subject, me, roleById]);

  const allowed = GROUPS.filter((g) => verdicts[g].ok).length;
  // "Alone with the bot" applies to every DJs row; say it once under the list.
  const alone = GROUPS.some((g) => verdicts[g].notes.includes(NOTE_ALONE));
  const who =
    subject === "me"
      ? "You"
      : subject === "admin"
        ? "Admins"
        : subject === "everyone"
          ? "@everyone"
          : `@${roleName(subject.slice(5))}`;

  return (
    <section aria-labelledby="perm-check" className="mt-16 xl:mt-0">
      <h2 id="perm-check" className="bill text-[34px] sm:text-[40px]">
        Check a member
      </h2>
      <p className="mt-1.5 text-[14px] leading-snug text-ink-2">See what a role can do here, and which rule decides each answer.</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor={selectId} className="mb-1 block text-[12px] font-bold uppercase tracking-wide text-ink-3">
            Member with
          </label>
          <Select id={selectId} value={subject} onChange={(e) => onSubject(e.target.value as CheckSubject)}>
            {me ? <option value="me">You ({me.username})</option> : null}
            <option value="everyone">No roles (@everyone)</option>
            {roles.map((r) => (
              <option key={r.id} value={`role:${r.id}`}>
                @{r.name}
              </option>
            ))}
            <option value="admin">Manage Server (admin)</option>
          </Select>
        </div>
        <p className="pb-2 text-[14px] text-ink-2" aria-live="polite">
          <span className="clock text-[22px] text-ink">{allowed}</span>
          <span className="clock text-[15px] text-ink-3">/{GROUPS.length}</span> allowed
        </p>
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3">
        {subject === "me"
          ? dirty
            ? "Your access as the server checks it, from the saved rules. Save to include your changes."
            : "Your access as the server checks it."
          : dirty
            ? "Includes your unsaved changes."
            : "From the saved rules."}
      </p>

      <ul aria-label={`What ${who} can do`} className="mt-3 border-t-2 border-ink">
        {GROUPS.map((g) => {
          const v = verdicts[g];
          const notes = v.notes.filter((n) => n !== NOTE_ALONE);
          return (
            <li key={g} className="flex gap-3 border-b border-rule py-2">
              <span
                aria-hidden
                className={cx(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px]",
                  v.ok ? "bg-ink text-stock" : "dashed text-now",
                )}
              >
                {v.ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-semibold leading-snug text-ink">{GROUP_INFO[g].name}</span>
                  <span className={cx("shrink-0 text-[11.5px] font-bold uppercase tracking-wide", v.ok ? "text-ink" : "text-now")}>
                    {v.ok ? "Allowed" : "Blocked"}
                  </span>
                </div>
                <p className="text-[12.5px] leading-snug text-ink-3">{v.rule}</p>
                {notes.length ? <p className="text-[12.5px] leading-snug text-ink-2">Unless {listOr(notes)}.</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {alone ? <p className="mt-2.5 text-[12.5px] leading-snug text-ink-2">Blocked by a DJs rule? They still pass when they&apos;re alone with the bot.</p> : null}
    </section>
  );
}

function listOr(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}
