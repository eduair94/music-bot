import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Insights",
  robots: { index: false, follow: false },
};

export default function InsightsLayout({ children }: { children: React.ReactNode }) {
  return <div className="antialiased noise bg-coal text-cream min-h-screen font-sans">{children}</div>;
}
