/**
 * The player panel Bypass posts for every song, here as the reply to
 * /nowplaying (commands/nowplaying.ts → PlayerPanelService.repost), drawn in
 * Discord's dark theme. Mirrors services/playerPanel.ts buildContainer: a
 * Components V2 container with the default amber accent, "-# ▶ Now playing",
 * the title as a heading link, artist · length · requester, the text progress
 * bar (utils/format.ts progressBar, 18 wide, at 2:31 of 3:47), the state line,
 * "Up next", the provider credit, a divider and the three button rows. The
 * thumbnail is neutral art standing in for the track's own.
 * Static markup — an illustration, not live controls. If the panel changes,
 * update this.
 */

import BrandMark from "@/components/common/BrandMark";

type ButtonStyle = "secondary" | "primary" | "danger";

const BUTTON_ROWS: { label: string; name: string; style?: ButtonStyle }[][] = [
  [
    { label: "⏮️", name: "previous" },
    { label: "⏸️", name: "pause", style: "primary" },
    { label: "⏭️", name: "skip" },
    { label: "⏹️", name: "stop", style: "danger" },
    { label: "📜", name: "queue" },
  ],
  [
    { label: "🔁", name: "loop" },
    { label: "🔀", name: "shuffle" },
    { label: "🔉", name: "volume down" },
    { label: "🔊", name: "volume up" },
    { label: "♾️", name: "autoplay" },
  ],
  [
    { label: "🎤 Lyrics", name: "lyrics" },
    { label: "💾 Save", name: "save" },
  ],
];

const BUTTON_STYLES: Record<ButtonStyle, string> = {
  secondary: "bg-[#4e5058]",
  primary: "bg-[#5865f2]",
  danger: "bg-[#da373c]",
};

// progressBar(151_000, 227_000, 18): 11 filled, the knob, 6 empty.
const PROGRESS = `${"━".repeat(11)}●${"─".repeat(6)}`;

const DESCRIPTION =
  "A Bypass player panel in Discord: Midnight City by M83, two and a half minutes in, sent as Opus at 256 kbps, with buttons for previous, pause, skip, stop, queue, loop, shuffle, volume, autoplay, lyrics and save.";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[4px] bg-[#1e1f22] px-1 py-px font-mono text-[0.8125rem] text-[#dbdee1]">
      {children}
    </code>
  );
}

/** Night skyline in 16:9, letterboxed into the 80px thumbnail box like a video still. */
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

            {/* Components V2 container: amber accent (DEFAULT_ACCENT), thumbnail as the section accessory */}
            <div className="mt-1.5 max-w-[32rem] rounded-lg border-l-4 border-[#f8aa2a] bg-[#2b2d31] p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4">
                <div className="min-w-0">
                  <div className="text-xs text-[#949ba4]">▶ Now playing</div>
                  <div className="mt-1 text-lg font-bold leading-tight text-[#00a8fc]">Midnight City</div>
                  <div className="mt-1 text-[0.875rem]">
                    M83 · <Code>3:47</Code> · requested by{" "}
                    <span className="rounded-[3px] bg-[#5865f2]/30 px-0.5 font-medium text-[#c9cdfb]">@maya</span>
                  </div>
                </div>
                <div className="hidden pt-0.5 @min-[30rem]:block">
                  <Thumbnail />
                </div>
              </div>

              <p className="mt-2 text-[0.875rem] [overflow-wrap:anywhere]">
                <Code>2:31</Code> <span className="tracking-[-0.06em]">{PROGRESS}</span> <Code>3:47</Code>
              </p>
              <p className="mt-0.5 text-[0.875rem]">🔊 Volume 80% · 🎚️ Opus 256 kbps</p>
              <p className="mt-0.5 text-xs text-[#949ba4]">Up next: Wait (+13 more)</p>
              <p className="mt-0.5 text-xs text-[#949ba4]">
                ⚡ Powered by <span className="text-[#00a8fc]">spotify.checkleaked.cc</span>
              </p>

              <div className="my-3 h-px bg-white/10" aria-hidden="true" />

              <div className="space-y-2">
                {BUTTON_ROWS.map((row, i) => (
                  <div key={i} className="flex flex-wrap gap-2 @max-[30rem]:gap-1.5">
                    {row.map(({ label, name, style = "secondary" }) => (
                      <span
                        key={name}
                        className={`inline-flex h-8 min-w-[2.75rem] items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-medium text-white @max-[30rem]:min-w-[2.5rem] @max-[30rem]:px-2 ${BUTTON_STYLES[style]}`}
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
    </div>
  );
}
