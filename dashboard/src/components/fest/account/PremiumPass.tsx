/**
 * The Founder tier as a backstage laminate. The pass art is blank; the plan
 * name and price are set in HTML over its empty panel, tilted to match the
 * card (-3.3°) and multiplied so the ink reads as printed on it.
 *
 * Authored motion: the pass swings in once from -8° on its lanyard and
 * settles (700 ms, ease-out). Reduced motion: it simply hangs there.
 */

const CSS = `
@keyframes pass-swing {
  0% { transform: rotate(-8deg); }
  55% { transform: rotate(1.6deg); }
  100% { transform: rotate(0deg); }
}
.pass-swing {
  transform-origin: 51.7% 0.4%;
  animation: pass-swing 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .pass-swing { animation: none; }
}
`;

export function PremiumPass({ price, spots }: { price: number; spots: number }) {
  return (
    <figure className="pass-swing @container relative mx-auto w-full max-w-[22rem]" aria-label={`Founder pass: $${price} a month, ${spots} spots`}>
      <style>{CSS}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/dash/backstage-pass.webp"
        alt=""
        width={733}
        height={1100}
        draggable={false}
        className="block w-full select-none drop-shadow-[0_18px_22px_rgb(21_21_21/0.16)]"
      />
      <div
        aria-hidden
        className="absolute flex flex-col justify-center text-ink mix-blend-multiply"
        style={{ left: "20%", right: "21%", top: "49%", bottom: "20%", transform: "rotate(-3.3deg)" }}
      >
        <p className="bill text-[14.5cqw] leading-[0.86]">Founder</p>
        <p className="mt-[3cqw] flex items-baseline gap-[1.6cqw]">
          <span className="clock text-[16cqw] leading-[0.8]">${price}</span>
          <span className="text-[4.4cqw] font-semibold leading-tight">a month</span>
        </p>
        <p className="mt-[3.4cqw] text-[3.6cqw] font-bold uppercase tracking-[0.1em]">{spots} spots · Patreon</p>
      </div>
    </figure>
  );
}
