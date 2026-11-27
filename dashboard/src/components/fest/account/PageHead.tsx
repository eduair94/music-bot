import type { ReactNode } from "react";

/**
 * Title row shared by the account screens, set like the Fleet: condensed
 * caps title, one line of status beside it, actions at the right, and the
 * heavy ink rule where the page's content starts.
 */
export function PageHead({ title, status, actions }: { title: string; status?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-5 gap-y-2 border-b-2 border-ink px-4 pb-3 pt-4 sm:px-6">
      <h1 className="bill text-[52px] leading-[0.85] sm:text-[60px]">{title}</h1>
      {status ? <p className="pb-1 text-[15px] text-ink-2">{status}</p> : null}
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2 pb-1">{actions}</div> : null}
    </div>
  );
}
