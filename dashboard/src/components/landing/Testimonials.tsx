import type { Testimonial } from "@/lib/testimonials-shape";

/** Middle dot for the eye, a comma for screen readers. */
function Sep() {
  return (
    <>
      <span aria-hidden="true"> · </span>
      <span className="sr-only">, </span>
    </>
  );
}

/**
 * Quotes from feedback whose authors allowed quoting and that the owner
 * featured in the console (Admin > Feedback). Rendered inside the Trust
 * section, after its three checks, on the same three columns. Renders nothing
 * at all when there are no quotes: no placeholder, no "coming soon".
 * Server component: no client JS.
 */
export default function Testimonials({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-20 lg:mt-24">
      <div className="mb-8 grid gap-x-8 gap-y-2 lg:grid-cols-12 lg:items-end">
        <h3 id="testimonials-title" className="lg:col-span-8 font-display text-xl font-semibold text-cream">
          What people wrote to us
        </h3>
        <p className="lg:col-span-4 lg:col-start-9 max-w-[34rem] text-sm text-dune leading-relaxed text-pretty">
          Sent through the feedback form or /feedback in Discord, and quoted with the author&apos;s permission.
        </p>
      </div>

      <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-labelledby="testimonials-title">
        {items.map((t, i) => (
          <li key={i} className="border-t border-line pt-5 sm:pt-6">
            <figure>
              <blockquote className="max-w-[40ch] text-[1.0625rem] text-cream leading-relaxed text-pretty">
                <p>&ldquo;{t.quote}&rdquo;</p>
              </blockquote>
              <figcaption className="mt-4 text-sm text-dune">
                {t.attribution}
                {t.month && (
                  <>
                    <Sep />
                    <time dateTime={t.monthIso ?? undefined}>{t.month}</time>
                  </>
                )}
                {t.viaDiscord && (
                  <>
                    <Sep />
                    via Discord
                  </>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
