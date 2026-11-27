import { ArrowUpRight } from "lucide-react";
import { InviteTile, type ServerTile } from "./ServerTiles";
import { btn, cx } from "./styles";

/**
 * The open stage under a short list of servers (or in place of an empty
 * one): invite Bypass to a server through Discord's picker, or straight to
 * one of the servers you manage that doesn't have it yet.
 */
export function InviteSlab({
  empty,
  inviteHref,
  addable,
}: {
  /** No server has Bypass yet: the slab is the whole page. */
  empty: boolean;
  /** Invite link that lets Discord ask which server. */
  inviteHref: string;
  addable: { guild: ServerTile; href: string }[];
}) {
  return (
    <section
      aria-labelledby="invite-bypass"
      className={cx(
        "grid items-center gap-x-8 gap-y-8 lg:grid-cols-12",
        empty ? "pt-4" : "pt-16",
      )}
    >
      <div className="min-w-0 lg:col-span-6 xl:col-span-6">
        <h2 id="invite-bypass" className="bill text-[40px] leading-[0.9]">
          {empty ? "No stage set up yet" : "Invite Bypass"}
        </h2>
        <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-ink-2">
          {empty
            ? "Bypass isn't in any server you're in. Add it to a server where you have Manage Server, then come back here to run the player, the queue and the permissions from the browser."
            : "Add Bypass to another server where you have Manage Server. It turns up on this list with its stages, ready to run from the browser."}
        </p>
        <a href={inviteHref} target="_blank" rel="noreferrer" className={btn("ink", "lg", "mt-6")}>
          Add Bypass to a server <ArrowUpRight size={16} aria-hidden />
        </a>

        {addable.length ? (
          <div className="mt-12">
            <h3 className="text-[15px] font-semibold">Servers you manage without Bypass</h3>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {addable.map(({ guild, href }) => (
                <li key={guild.id} className="min-w-0">
                  <InviteTile guild={guild} href={href} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/dash/empty-stage.webp"
        alt=""
        width={960}
        height={640}
        className="mx-auto w-full max-w-[26rem] lg:col-span-6 lg:col-start-7 lg:max-w-[36rem] xl:col-span-5 xl:col-start-8"
      />
    </section>
  );
}
