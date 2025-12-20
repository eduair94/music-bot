"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#commands", label: "Commands" },
    { href: "#pricing", label: "Premium" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "bg-[#0f0f23]/90 backdrop-blur-lg shadow-lg" : "bg-transparent"}`}>
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5865f2] to-[#eb459e] flex items-center justify-center text-xl">
              &#x1F3B5;
            </div>
            <span className="text-xl font-bold gradient-text">Bypass</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-gray-300 hover:text-white transition-colors font-medium">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <a href="https://www.patreon.com/cw/BypassDiscordBot" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 text-[#f96854] hover:bg-[#f96854]/10 rounded-lg transition-colors font-medium">
              Patreon
            </a>
            <Link href="/invite" className="flex items-center gap-2 px-5 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl transition-all font-semibold">
              Add to Discord
            </Link>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-300 hover:text-white"
            aria-label="Toggle mobile menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </nav>

        <div className={`md:hidden overflow-hidden transition-all duration-300 ${isMobileMenuOpen ? "max-h-96 pb-6" : "max-h-0"}`}>
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition-colors font-medium py-2">
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
              <a href="https://www.patreon.com/cw/BypassDiscordBot" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-4 py-3 text-[#f96854] border border-[#f96854]/30 rounded-xl">
                Patreon
              </a>
              <Link href="/invite" className="flex items-center justify-center gap-2 px-4 py-3 bg-[#5865f2] text-white rounded-xl font-semibold">
                Add to Discord
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
