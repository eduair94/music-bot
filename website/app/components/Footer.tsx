"use client";

import Link from "next/link";
import { Github } from "lucide-react";
import { FaDiscord, FaPatreon } from "react-icons/fa";

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
                  <FaDiscord className="w-5 h-5" />
                </a>
              )}
              <a href="https://github.com/eduair94/music-bot" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-white/20 rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all" title="GitHub">
                <Github className="w-5 h-5" />
              </a>
              <a href="https://www.patreon.com/cw/BypassDiscordBot" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 hover:bg-[#f96854] rounded-lg flex items-center justify-center text-gray-400 hover:text-white transition-all" title="Patreon">
                <FaPatreon className="w-5 h-5" />
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
