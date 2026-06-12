/**
 * Bypass brand mark — five waveform bars on a machined panel.
 * Pure SVG, no dependencies; safe in server and client components.
 */
export default function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="46" height="46" rx="10" fill="#1d1916" stroke="#3d342c" />
      <rect x="1" y="1" width="46" height="46" rx="10" fill="url(#bm-sheen)" />
      <g fill="#f8aa2a">
        <rect x="10" y="20" width="4" height="12" rx="2" />
        <rect x="17" y="14" width="4" height="24" rx="2" />
        <rect x="24" y="8" width="4" height="32" rx="2" fill="#ffc24d" />
        <rect x="31" y="16" width="4" height="20" rx="2" />
        <rect x="38" y="22" width="4" height="8" rx="2" />
      </g>
      <defs>
        <linearGradient id="bm-sheen" x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Wordmark lockup: mark + "BYPASS" in display type */
export function BrandLockup({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-3">
      <BrandMark size={size} />
      <span
        className="font-display font-bold tracking-tight text-cream"
        style={{ fontSize: size * 0.56 }}
      >
        Bypass
      </span>
    </span>
  );
}
