"use client";

export const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "servers", label: "Servers" },
  { id: "activity", label: "Activity" },
  { id: "premium", label: "Premium & Bots" },
  { id: "logs", label: "Logs" },
  { id: "audit", label: "Audit" }
] as const;

export function SectionNav() {
  return (
    <nav
      aria-label="Admin sections"
      className="sticky top-16 z-20 -mx-2 mb-8 overflow-x-auto bg-coal/90 backdrop-blur px-2 py-2 border-b border-line"
    >
      <ul className="flex gap-1 min-w-max">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="block rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-dune hover:text-cream hover:bg-panel-raised"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
