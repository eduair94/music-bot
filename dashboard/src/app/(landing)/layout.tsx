/**
 * Landing Page Layout — studio-console chassis.
 * Tailwind-only marketing pages; globals.css imported in root layout.
 */

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="antialiased noise bg-coal text-cream min-h-screen font-sans">
      {children}
    </div>
  );
}
