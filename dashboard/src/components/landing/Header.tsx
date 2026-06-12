"use client";

import BrandMark from "@/components/common/BrandMark";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaDiscord, FaPatreon } from "react-icons/fa";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "/commands", label: "Commands", isRoute: true },
    { href: "/install", label: "Install", isRoute: true },
    { href: "/support", label: "Support", isRoute: true },
    { href: "/dashboard", label: "Dashboard", isRoute: true },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
          isScrolled
            ? "bg-coal/95 backdrop-blur-md border-line"
            : "bg-transparent border-transparent"
        }`}
      >
        <div className="container mx-auto px-4">
          <nav className="flex items-center justify-between h-18">
            <Link href="/" className="flex items-center gap-3 focus-amber">
              <BrandMark size={36} />
              <span className="font-display text-xl font-bold tracking-tight">
                Bypass
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) =>
                link.isRoute ? (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-4 py-2 text-sm text-dune hover:text-cream transition-colors font-medium focus-amber"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    className="px-4 py-2 text-sm text-dune hover:text-cream transition-colors font-medium focus-amber"
                  >
                    {link.label}
                  </a>
                )
              )}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <a
                href="https://patreon.com/u36360623"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 text-sm text-dune hover:text-cream border border-line hover:border-line-bright rounded-lg transition-colors font-medium focus-amber"
              >
                <FaPatreon className="w-4 h-4" />
                Patreon
              </a>
              <Link
                href="/invite"
                className="flex items-center gap-2 px-5 py-2.5 text-sm bg-amber hover:bg-amber-hot text-coal rounded-lg transition-colors font-semibold focus-amber"
              >
                <FaDiscord className="w-4 h-4" />
                Add to Discord
              </Link>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-dune hover:text-cream z-50 focus-amber"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-panel border-r border-line z-50 md:hidden transform transition-transform duration-300 ease-in-out ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-line">
            <Link
              href="/"
              className="flex items-center gap-3"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <BrandMark size={34} />
              <span className="font-display text-lg font-bold">Bypass</span>
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-dune hover:text-cream transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 py-6">
            <div className="flex flex-col gap-1 px-4">
              {navLinks.map((link) =>
                link.isRoute ? (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-dune hover:text-cream hover:bg-panel-raised rounded-lg transition-all font-medium"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-dune hover:text-cream hover:bg-panel-raised rounded-lg transition-all font-medium"
                  >
                    {link.label}
                  </a>
                )
              )}
            </div>
          </nav>

          <div className="p-6 border-t border-line space-y-3">
            <a
              href="https://patreon.com/u36360623"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 text-dune border border-line hover:border-line-bright hover:text-cream rounded-lg transition-colors font-medium"
            >
              <FaPatreon className="w-4 h-4" />
              Patreon
            </a>
            <Link
              href="/invite"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-amber hover:bg-amber-hot text-coal rounded-lg font-semibold transition-colors"
            >
              <FaDiscord className="w-4 h-4" />
              Add to Discord
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
