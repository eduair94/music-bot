import BrandMark from "@/components/common/BrandMark";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-coal text-cream font-sans flex items-center justify-center raster">
      <div className="text-center px-4">
        <div className="flex justify-center mb-8">
          <BrandMark size={56} />
        </div>
        <div className="console-label text-amber! mb-4">No signal on this channel</div>
        <h1 className="font-display text-7xl md:text-9xl font-bold tracking-tight">
          4<span className="text-amber">0</span>4
        </h1>
        <p className="text-dune mt-6 max-w-md mx-auto">
          This page dropped out of the queue. Head back and put something
          good on.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-8 py-3.5 bg-amber hover:bg-amber-hot text-coal font-semibold rounded-lg transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/commands"
            className="inline-flex items-center justify-center px-8 py-3.5 border border-line-bright hover:border-amber/60 text-cream font-semibold rounded-lg transition-colors"
          >
            Browse commands
          </Link>
        </div>
      </div>
    </div>
  );
}
