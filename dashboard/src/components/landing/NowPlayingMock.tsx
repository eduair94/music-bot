/**
 * The reply Bypass posts for /nowplaying (see commands/nowplaying.ts), drawn in
 * Discord's dark theme: the bot's title, fields, text progress bar (string-
 * progressbar's splitBar at 2:31 of 3:47), footer and both rows of button
 * labels. The thumbnail is neutral art standing in for the track's own.
 * Static markup — an illustration, not live controls.
 */

import BrandMark from "@/components/common/BrandMark";

type ButtonStyle = "secondary" | "primary" | "danger";

const BUTTON_ROWS: { label: string; style?: ButtonStyle }[][] = [
  [
    { label: "⏪ 1m" },
    { label: "⏪ 30s" },
    { label: "⏪ 10s" },
    { label: "⏸️ Pause", style: "primary" },
    { label: "⏹️ Stop", style: "danger" },
  ],
  [
    { label: "10s ⏩" },
    { label: "30s ⏩" },
    { label: "1m ⏩" },
    { label: "⏭️ Skip", style: "primary" },
    { label: "🔄" },
  ],
];

const BUTTON_STYLES: Record<ButtonStyle, string> = {
  secondary: "bg-[#4e5058]",
  primary: "bg-[#5865f2]",
  danger: "bg-[#da373c]",
};

const FIELDS = [
  { name: "🎤 Artist", value: "M83" },
  { name: "🎵 Source", value: "youtube" },
  { name: "🔊 Quality", value: "🔊 HQ 320kbps" },
];

const DESCRIPTION =
  "A Bypass now-playing message in Discord: Midnight City by M83 from YouTube at 320 kbps, two and a half minutes in, with buttons to seek, pause, stop, skip and refresh.";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[4px] bg-[#1e1f22] px-1 py-px font-mono text-[0.8125rem] text-[#dbdee1]">
      {children}
    </code>
  );
}

/** Night skyline in 16:9, letterboxed into the embed's 80px thumbnail box like a video still. */
function Thumbnail() {
  return (
    <svg viewBox="0 0 80 45" className="h-[45px] w-20 rounded-[4px]" aria-hidden="true">
      <defs>
        <linearGradient id="np-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141a33" />
          <stop offset="0.65" stopColor="#3b2748" />
          <stop offset="1" stopColor="#8a4a2a" />
        </linearGradient>
      </defs>
      <rect width="80" height="45" fill="url(#np-sky)" />
      <path
        d="M0 45V31h6v-5h5v8h4V22h6v12h3v-7h5v-9h4v11h4v-6h6v13h3V25h5v8h4v-5h6v6h3v-9h5v20z"
        fill="#0c0a09"
      />
      <g fill="#f8aa2a">
        <rect x="16" y="26" width="1.5" height="1.5" />
        <rect x="18.5" y="30" width="1.5" height="1.5" />
        <rect x="31" y="22" width="1.5" height="1.5" />
        <rect x="33.5" y="27" width="1.5" height="1.5" opacity="0.6" />
        <rect x="47" y="31" width="1.5" height="1.5" />
        <rect x="58" y="28" width="1.5" height="1.5" opacity="0.6" />
        <rect x="70" y="33" width="1.5" height="1.5" />
      </g>
    </svg>
  );
}

export default function NowPlayingMock() {
  return (
    <div
      role="img"
      aria-label={DESCRIPTION}
      className="@container overflow-hidden rounded-xl border border-white/10 bg-[#313338] text-[0.9375rem] leading-snug text-[#dbdee1] shadow-[0_32px_64px_-24px_rgba(0,0,0,0.85)]"
    >
      {/* Channel bar */}
      <div className="flex h-12 items-center gap-2 border-b border-black/30 px-4">
        <span className="text-xl leading-none text-[#80848e]">#</span>
        <span className="font-semibold text-[#f2f3f5]">music</span>
      </div>

      <div className="px-4 pb-5 pt-4">
        {/* "maya used /nowplaying" — the interaction this message answers */}
        <div className="relative flex items-center gap-1.5 pl-14 text-[0.8125rem] text-[#949ba4]">
          <span
            className="absolute left-[1.15rem] top-1/2 h-3 w-8 rounded-tl-md border-l-2 border-t-2 border-[#4e5058]"
            aria-hidden="true"
          />
          <span className="h-4 w-4 rounded-full bg-[#c27c0e]" />
          <span className="font-medium text-[#f2f3f5]/90">maya</span>
          <span>used</span>
          <span className="text-[#00a8fc]">/nowplaying</span>
        </div>

        <div className="mt-1 flex gap-4">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
            <BrandMark size={40} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-[#f2f3f5]">Bypass</span>
              <span className="rounded-[3px] bg-[#5865f2] px-1 text-[0.625rem] font-semibold leading-[0.9375rem] text-white">
                APP
              </span>
              <span className="ml-1 text-xs text-[#949ba4]">Today at 21:14</span>
            </div>

            {/* Embed: #00FF00 while playing, as the bot sets it; thumbnail at top right */}
            <div className="mt-1.5 grid max-w-[32rem] grid-cols-[minmax(0,1fr)_auto] gap-x-4 rounded-[4px] border-l-4 border-[#00ff00] bg-[#2b2d31] py-3 pl-3 pr-4">
              <div className="min-w-0">
                <div className="font-semibold text-[#f2f3f5]">▶️ Now playing</div>
                <div className="mt-1.5 font-semibold text-[#00a8fc]">Midnight City</div>

                <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2">
                  {FIELDS.map((field) => (
                    <div key={field.name} className="min-w-0">
                      <dt className="text-[0.8125rem] font-semibold text-[#f2f3f5]">{field.name}</dt>
                      <dd className="mt-0.5 text-[0.8125rem]">{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="hidden pt-0.5 @min-[30rem]:block">
                <Thumbnail />
              </div>

              <dl className="col-span-2 mt-3">
                <dt className="text-[0.8125rem] font-semibold text-[#f2f3f5]">⏱️ Progress</dt>
                <dd className="mt-1 text-[0.8125rem] leading-relaxed [overflow-wrap:anywhere]">
                  <Code>00:02:31</Code> [▬▬▬▬▬▬▬▬▬▬▬▬🔘▬▬▬▬▬▬▬] <Code>00:03:47</Code>
                </dd>
              </dl>

              <p className="col-span-2 mt-3 text-xs text-[#949ba4] text-pretty">
                ⏳ Time Remaining: 00:01:16 • Queue: 14 tracks
              </p>
            </div>

            <div className="mt-2 space-y-2">
              {BUTTON_ROWS.map((row, i) => (
                <div key={i} className="flex flex-wrap gap-2 @max-[30rem]:gap-1.5">
                  {row.map(({ label, style = "secondary" }) => (
                    <span
                      key={label}
                      className={`inline-flex h-8 min-w-[3.25rem] items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-white @max-[30rem]:px-2.5 ${BUTTON_STYLES[style]}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
