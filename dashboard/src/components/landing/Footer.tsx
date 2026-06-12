"use client";

import BrandMark from "@/components/common/BrandMark";
import { Github } from "lucide-react";
import Link from "next/link";
import { FaDiscord, FaPatreon } from "react-icons/fa";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE;

  return (
    <footer className="bg-panel border-t border-line">
      {/* Tick ruler crown */}
      <div className="ruler-x" />

      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-5">
              <BrandMark size={38} />
              <span className="font-display text-xl font-bold tracking-tight">Bypass</span>
            </div>
            <p className="text-dune mb-6 max-w-md leading-relaxed">
              The studio-grade Discord music bot. Powerful queue management,
              320kbps audio, and a full web dashboard. Free to use, forever.
            </p>
            <div className="flex gap-3">
              {discordInvite && (
                <a
                  href={discordInvite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-panel-raised border border-line hover:border-amber/60 hover:text-amber rounded-lg flex items-center justify-center text-dune transition-all focus-amber"
                  title="Discord"
                >
                  <FaDiscord className="w-4 h-4" />
                </a>
              )}
              <a
                href="https://github.com/eduair94/music-bot"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-panel-raised border border-line hover:border-amber/60 hover:text-amber rounded-lg flex items-center justify-center text-dune transition-all focus-amber"
                title="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://patreon.com/u36360623"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-panel-raised border border-line hover:border-amber/60 hover:text-amber rounded-lg flex items-center justify-center text-dune transition-all focus-amber"
                title="Patreon"
              >
                <FaPatreon className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="console-label mb-5">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#features" className="text-dune hover:text-cream transition-colors">Features</a></li>
              <li><Link href="/commands" className="text-dune hover:text-cream transition-colors">Commands</Link></li>
              <li><Link href="/install" className="text-dune hover:text-cream transition-colors">Installation Guide</Link></li>
              <li><a href="#pricing" className="text-dune hover:text-cream transition-colors">Premium</a></li>
              <li><Link href="/invite" className="text-dune hover:text-cream transition-colors">Add to Discord</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="console-label mb-5">Support</h4>
            <ul className="space-y-3 text-sm">
              <li><Link href="/support" className="text-dune hover:text-cream transition-colors">Discord Server</Link></li>
              <li><a href="https://github.com/eduair94/music-bot/issues" target="_blank" rel="noopener noreferrer" className="text-dune hover:text-cream transition-colors">Report a Bug</a></li>
              <li><a href="https://github.com/eduair94/music-bot" target="_blank" rel="noopener noreferrer" className="text-dune hover:text-cream transition-colors">GitHub</a></li>
              <li><a href="https://patreon.com/u36360623" target="_blank" rel="noopener noreferrer" className="text-dune hover:text-cream transition-colors">Patreon</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-line flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-mono text-xs text-dust">
            © {currentYear} BYPASS · MADE FOR THE DISCORD COMMUNITY
          </p>
          <div className="flex gap-6">
            <Link href="/privacy" className="text-dust hover:text-cream text-sm transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-dust hover:text-cream text-sm transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
