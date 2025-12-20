import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Bypass - Discord Music Bot | Free & Premium Features",
  description: "The ultimate Discord music bot with YouTube support, playlists, audio controls, and premium features. Add Bypass to your server today!",
  keywords: ["Discord", "Music Bot", "YouTube", "Playlists", "Bypass", "Free Music Bot"],
  authors: [{ name: "Bypass Team" }],
  openGraph: {
    title: "Bypass - Discord Music Bot",
    description: "The ultimate Discord music bot with YouTube support, playlists, and premium features.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bypass - Discord Music Bot",
    description: "The ultimate Discord music bot with YouTube support, playlists, and premium features.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${inter.variable} ${poppins.variable} antialiased bg-[#0f0f23] text-white`}
      >
        {children}
      </body>
    </html>
  );
}
