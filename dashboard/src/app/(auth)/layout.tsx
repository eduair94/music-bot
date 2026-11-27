import type { Metadata } from "next";
import { Anybody, Public_Sans } from "next/font/google";

const anybody = Anybody({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-anybody",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-public",
});

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/** Sign-in lives outside the dashboard layout, so it carries the bill's fonts and stock itself. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className={`fest ${anybody.variable} ${publicSans.variable}`}>{children}</div>;
}
