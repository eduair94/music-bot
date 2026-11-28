import Analytics from "@/components/analytics/Analytics";
import { ANALYTICS_ENABLED } from "@/lib/analytics/config";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// All three fonts use `optional`: the preloaded file is used when it arrives within
// the block period, otherwise the metric-matched fallback stays for this visit and
// the real font is cached for the next one. That removes every font-swap layout
// shift (headline reflow pushing the page, pill rows re-wrapping).
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "optional",
  variable: "--font-bricolage",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  display: "optional",
  variable: "--font-instrument",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "optional",
  variable: "--font-jetbrains",
});

const TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

// Search Console / Bing Webmaster ownership tags, inlined at build time; omitted when unset.
const GSC_VERIFICATION = process.env.NEXT_PUBLIC_GSC_VERIFICATION || "";
const BING_VERIFICATION = process.env.NEXT_PUBLIC_BING_VERIFICATION || "";
const verification: Metadata["verification"] =
  GSC_VERIFICATION || BING_VERIFICATION
    ? {
        ...(GSC_VERIFICATION ? { google: GSC_VERIFICATION } : {}),
        ...(BING_VERIFICATION ? { other: { "msvalidate.01": BING_VERIFICATION } } : {}),
      }
    : undefined;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  category: "technology",
  ...(verification ? { verification } : {}),
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable}`}>
      <body>
        {children}
        {/* GA4 + Clarity + consent; absent from the page when neither id is configured. */}
        {ANALYTICS_ENABLED ? <Analytics /> : null}
      </body>
    </html>
  );
}
