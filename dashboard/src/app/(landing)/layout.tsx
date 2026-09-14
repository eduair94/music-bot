/**
 * Landing Page Layout — studio-console chassis.
 * Tailwind-only marketing pages; globals.css imported in root layout.
 * Header, footer, and the main landmark live here so every page shares them.
 */

import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="antialiased noise bg-coal text-cream min-h-screen font-sans">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main" className="min-h-screen">
        {children}
      </main>
      <Footer />
    </div>
  );
}
