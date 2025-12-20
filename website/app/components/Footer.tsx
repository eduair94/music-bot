"use client";

import Link from "next/link";
import { Github } from "lucide-react";

// Custom Patreon icon since Lucide doesn't have one
const PatreonIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524M.003 23.537h4.22V.524H.003"/>
  </svg>
);

// Custom Discord icon since Lucide doesn't have one
const DiscordIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
  </svg>
);

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE;

  return (
    <footer className="bg-[#0a0a1a] border-t border-white/10">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5865f2] to-[#eb459e] flex items-center justify-center text-xl">
                &#x1F3B5;
              </div>
              <span className="text-xl font-bold gradient-text">Bypass</span>
            </div>
            <p className="text-gray-400 mb-6 max-w-md">
              The ultimate Discord music bot with YouTube support, powerful queue management, 
              and premium features. Free to use, forever.
            </p>
            <div className="flex gap-4">
              {discordInvite && (
                <a href={discordInvite} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-[#5865f2] rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all" title="Discord">
                  <DiscordIcon />
                </a>
              )}
              <a href="https://github.com/eduair94/music-bot" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/20 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all" title="GitHub">
                <Github className="w-5 h-5" />
              </a>
              <a href="https://www.patreon.com/cw/BypassDiscordBot" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-[#f96854] rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all" title="Patreon">
                <PatreonIcon />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-3">
              <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
              <li><a href="#commands" className="text-gray-400 hover:text-white transition-colors">Commands</a></li>
              <li><a href="#pricing" className="text-gray-400 hover:text-white transition-colors">Premium</a></li>
              <li><a href="#faq" className="text-gray-400 hover:text-white transition-colors">FAQ</a></li>
              <li><Link href="/invite" className="text-gray-400 hover:text-white transition-colors">Add to Discord</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Support</h4>
            <ul className="space-y-3">
              {discordInvite && (
                <li><a href={discordInvite} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Discord Server</a></li>
              )}
              <li><a href="https://github.com/eduair94/music-bot/issues" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Report a Bug</a></li>
              <li><a href="https://github.com/eduair94/music-bot" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">GitHub</a></li>
              <li><a href="https://www.patreon.com/cw/BypassDiscordBot" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">Patreon</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">
            {currentYear} Bypass. Made with love for the Discord community.
          </p>
          <p className="text-gray-500 text-sm">
            Not affiliated with Discord Inc. or YouTube.
          </p>
        </div>
      </div>
    </footer>
  );
}
