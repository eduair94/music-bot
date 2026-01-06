"use client";

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
                link.isRoute ? (
                  <Link key={link.href} href={link.href} className="text-gray-300 hover:text-white transition-colors font-medium">
                    {link.label}
                  </Link>
                ) : (
                  <a key={link.href} href={link.href} className="text-gray-300 hover:text-white transition-colors font-medium">
                    {link.label}
                  </a>
                )
              ))}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <a href="https://patreon.com/u36360623" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 text-[#f96854] hover:bg-[#f96854]/10 rounded-lg transition-colors font-medium">
                <FaPatreon className="w-5 h-5" />
                Patreon
              </a>
              <Link href="/invite" className="flex items-center gap-2 px-5 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl transition-all font-semibold">
                <FaDiscord className="w-5 h-5" />
                Add to Discord
              </Link>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-300 hover:text-white z-50"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-[#0f0f23] z-50 md:hidden transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <Link href="/" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5865f2] to-[#eb459e] flex items-center justify-center text-xl">
                &#x1F3B5;
              </div>
              <span className="text-xl font-bold gradient-text">Bypass</span>
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex-1 py-6">
            <div className="flex flex-col gap-1 px-4">
              {navLinks.map((link) => (
                link.isRoute ? (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all font-medium"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all font-medium"
                  >
                    {link.label}
                  </a>
                )
              ))}
            </div>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-6 border-t border-white/10 space-y-3">
            <a
              href="https://patreon.com/u36360623"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 text-[#f96854] border border-[#f96854]/30 hover:bg-[#f96854]/10 rounded-xl transition-colors font-medium"
            >
              <FaPatreon className="w-5 h-5" />
              Patreon
            </a>
            <Link
              href="/invite"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl font-semibold transition-colors"
            >
              <FaDiscord className="w-5 h-5" />
              Add to Discord
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
