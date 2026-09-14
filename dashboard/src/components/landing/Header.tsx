"use client";

import BrandMark from "@/components/common/BrandMark";
import { PATREON_URL } from "@/lib/site";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { FaDiscord, FaPatreon } from "react-icons/fa";

const NAV_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/commands", label: "Commands" },
  { href: "/install", label: "Install" },
  { href: "/support", label: "Support", prefetch: false },
  { href: "/dashboard", label: "Dashboard", prefetch: false },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll, move focus into the drawer, close on Escape.
  useEffect(() => {
    if (!isMenuOpen) return;
    const toggle = toggleRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      toggle?.focus();
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color] duration-300 border-b ${
          isScrolled
            ? "bg-coal border-line"
            : "bg-transparent border-transparent"
        }`}
      >
        <div className="container mx-auto px-4">
          <nav className="flex items-center justify-between h-18" aria-label="Primary">
            <Link href="/" className="flex items-center gap-3 rounded-md" aria-label="Bypass home">
              <BrandMark size={36} />
              <span className="font-display text-xl font-bold tracking-tight">
                Bypass
              </span>
            </Link>

            <ul className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    prefetch={link.prefetch}
                    className="inline-flex items-center px-4 py-2.5 text-sm text-dune hover:text-cream transition-colors font-medium rounded-md"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden md:flex items-center gap-3">
              <a
                href={PATREON_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm text-dune hover:text-cream border border-line-strong hover:border-amber/60 rounded-lg transition-colors font-medium"
              >
                <FaPatreon className="w-4 h-4" aria-hidden="true" />
                Patreon
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              <Link
                href="/invite"
                prefetch={false}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm bg-amber hover:bg-amber-hot text-coal rounded-lg transition-colors font-semibold"
              >
                <FaDiscord className="w-4 h-4" aria-hidden="true" />
                Add to Discord
              </Link>
            </div>

            <button
              ref={toggleRef}
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="md:hidden -mr-2.5 p-2.5 text-dune hover:text-cream z-50 rounded-md"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              aria-controls={menuId}
            >
              {isMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside
        id={menuId}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        inert={!isMenuOpen}
        className={`fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-panel border-r border-line z-50 md:hidden transform transition-transform duration-300 ease-out ${
          isMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-5 border-b border-line">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-md"
              onClick={closeMenu}
              aria-label="Bypass home"
            >
              <BrandMark size={34} />
              <span className="font-display text-lg font-bold">Bypass</span>
            </Link>
            <button
              ref={closeRef}
              type="button"
              onClick={closeMenu}
              className="-mr-2.5 p-2.5 text-dune hover:text-cream transition-colors rounded-md"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          </div>

          <nav className="flex-1 py-4" aria-label="Mobile">
            <ul className="flex flex-col gap-1 px-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    prefetch={link.prefetch}
                    onClick={closeMenu}
                    className="flex items-center min-h-11 px-4 py-3 text-dune hover:text-cream hover:bg-panel-raised rounded-lg transition-colors font-medium"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-5 border-t border-line space-y-3">
            <a
              href={PATREON_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 min-h-11 px-4 py-3 text-dune border border-line-strong hover:border-amber/60 hover:text-cream rounded-lg transition-colors font-medium"
            >
              <FaPatreon className="w-4 h-4" aria-hidden="true" />
              Patreon
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <Link
              href="/invite"
              prefetch={false}
              onClick={closeMenu}
              className="flex items-center justify-center gap-2 min-h-11 px-4 py-3 bg-amber hover:bg-amber-hot text-coal rounded-lg font-semibold transition-colors"
            >
              <FaDiscord className="w-4 h-4" aria-hidden="true" />
              Add to Discord
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
