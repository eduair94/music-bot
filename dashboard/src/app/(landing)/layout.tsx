/**
 * Landing Page Layout
 * 
 * Uses Tailwind CSS for the marketing pages (home, invite)
 * Wraps landing pages with Tailwind-specific styling
 * globals.css is imported in root layout
 */

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="antialiased bg-[#0f0f23] text-white min-h-screen font-sans">
      {children}
    </div>
  );
}
