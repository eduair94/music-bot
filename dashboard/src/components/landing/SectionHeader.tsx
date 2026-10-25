/**
 * Section header shared by the marketing sections. On large screens the title
 * takes the first eight grid columns and the lede the last four, bottom-aligned:
 * the lede starts on column 9, the line where three-up content below begins its
 * third column.
 */

interface SectionHeaderProps {
  id: string;
  title: React.ReactNode;
  lede: React.ReactNode;
  as?: "h1" | "h2";
}

export default function SectionHeader({ id, title, lede, as: Heading = "h2" }: SectionHeaderProps) {
  return (
    <div className="grid gap-x-8 gap-y-5 lg:grid-cols-12 lg:items-end mb-12 lg:mb-16">
      <Heading
        id={id}
        className="lg:col-span-8 font-display font-bold text-cream text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.02] tracking-[-0.03em] text-balance"
      >
        {title}
      </Heading>
      <p className="lg:col-span-4 lg:col-start-9 max-w-[34rem] text-lg text-dune leading-relaxed text-pretty">{lede}</p>
    </div>
  );
}
