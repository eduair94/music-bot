import BrandMark from "@/components/common/BrandMark";
import { GITHUB_ISSUES_URL, GITHUB_URL, PATREON_URL } from "@/lib/site";
import { Github } from "lucide-react";
import Link from "next/link";
import { FaDiscord, FaPatreon } from "react-icons/fa";

const linkClass = "inline-block py-2 text-dune hover:text-cream transition-colors rounded-sm";
const iconLinkClass =
  "w-11 h-11 bg-panel-raised border border-line-strong hover:border-amber/60 hover:text-amber rounded-lg flex items-center justify-center text-dune transition-colors";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-panel border-t border-line">
      {/* Tick ruler crown */}
      <div className="ruler-x" aria-hidden="true" />

      <div className="shell py-16">
        {/* Link columns start on column 9, the line every section lede starts on. */}
        <div className="grid gap-12 md:grid-cols-12 md:gap-x-8">
          <div className="md:col-span-6 lg:col-span-5">
            <div className="flex items-center gap-3 mb-5">
              <BrandMark size={38} />
              <span className="font-display text-xl font-bold tracking-tight">Bypass</span>
            </div>
            <p className="text-dune mb-6 max-w-md leading-relaxed">
              The studio-grade Discord music bot. Powerful queue management,
              320kbps audio, and a full web dashboard. Free to use, forever.
            </p>
            <ul className="flex gap-3" role="list" aria-label="Community links">
              <li>
                <Link href="/support" prefetch={false} className={iconLinkClass} aria-label="Discord support server">
                  <FaDiscord className="w-4 h-4" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={iconLinkClass}
                  aria-label="GitHub repository (opens in a new tab)"
                >
                  <Github className="w-4 h-4" aria-hidden="true" />
                </a>
              </li>
              <li>
                <a
                  href={PATREON_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={iconLinkClass}
                  aria-label="Patreon (opens in a new tab)"
                >
                  <FaPatreon className="w-4 h-4" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>

          <nav aria-labelledby="footer-product" className="md:col-span-3 lg:col-span-2 lg:col-start-9">
            <h2 id="footer-product" className="console-label mb-4">Product</h2>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/#features" className={linkClass}>Features</Link></li>
              <li><Link href="/commands" className={linkClass}>Commands</Link></li>
              <li><Link href="/install" className={linkClass}>Installation guide</Link></li>
              <li><Link href="/#pricing" className={linkClass}>Premium</Link></li>
              <li><Link href="/invite" prefetch={false} className={linkClass}>Add to Discord</Link></li>
            </ul>
          </nav>

          <nav aria-labelledby="footer-support" className="md:col-span-3 lg:col-span-2 lg:col-start-11">
            <h2 id="footer-support" className="console-label mb-4">Support</h2>
            <ul className="space-y-1.5 text-sm">
              <li><Link href="/support" prefetch={false} className={linkClass}>Discord server</Link></li>
              <li>
                <a href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  Report a bug<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  GitHub<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
              <li>
                <a href={PATREON_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  Patreon<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 pt-8 border-t border-line flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-dust">
            © {currentYear} Bypass · Made for the Discord community
          </p>
          <nav aria-label="Legal">
            <ul className="flex gap-6 text-sm">
              <li><Link href="/privacy" className={linkClass}>Privacy Policy</Link></li>
              <li><Link href="/terms" className={linkClass}>Terms of Service</Link></li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
