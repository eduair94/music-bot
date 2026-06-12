import { SessionProvider } from "@/components/auth/SessionProvider";
import darkTheme from "@/theme/theme";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: {
    default: "Bypass — Studio-Grade Discord Music Bot",
    template: "%s · Bypass",
  },
  description:
    "Studio-grade music for your Discord server. Lossless-feel audio up to 320kbps, instant queueing, playlists, TTS voices, and a full web dashboard.",
  keywords: ["discord music bot", "discord bot", "music bot", "youtube bot", "spotify discord"],
  openGraph: {
    title: "Bypass — Studio-Grade Discord Music Bot",
    description:
      "Studio-grade music for your Discord server. 320kbps audio, instant queueing, playlists, and a full web dashboard.",
    type: "website",
    siteName: "Bypass",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bypass — Studio-Grade Discord Music Bot",
    description: "Studio-grade music for your Discord server.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0a09",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bricolage.variable} ${instrument.variable} ${jetbrains.variable}`}>
      <body style={{ margin: 0 }}>
        <SessionProvider>
          <AppRouterCacheProvider>
            <ThemeProvider theme={darkTheme}>
              <CssBaseline />
              {children}
            </ThemeProvider>
          </AppRouterCacheProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
