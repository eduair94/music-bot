/**
 * Installation Guide Page
 * 
 * Simple guide for adding the bot to a Discord server
 */

import Footer from "@/components/landing/Footer";
import Header from "@/components/landing/Header";
import { Metadata } from "next";
import Link from "next/link";
import { FaCheckCircle, FaCog, FaDiscord, FaMusic, FaUserShield } from "react-icons/fa";

export const metadata: Metadata = {
  title: "Add to Server - Bypass Discord Music Bot",
  description: "Add Bypass Discord Music Bot to your Discord server in seconds. Easy setup with slash commands.",
};

function StepCard({ number, icon, title, description, children }: { 
  number: number; 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
      <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full bg-gradient-to-br from-[#5865f2] to-[#eb459e] flex items-center justify-center text-white font-bold text-lg shadow-lg">
        {number}
      </div>
      <div className="flex items-center gap-3 mb-3 ml-4">
        <div className="w-10 h-10 rounded-xl bg-[#5865f2]/20 flex items-center justify-center text-[#5865f2]">
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-white">{title}</h3>
      </div>
      <p className="text-gray-400 ml-4">{description}</p>
      {children && <div className="mt-4 ml-4">{children}</div>}
    </div>
  );
}

function PermissionBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#5865f2]/20 text-[#5865f2] rounded-full text-sm border border-[#5865f2]/30">
      <FaCheckCircle className="w-3 h-3" />
      {name}
    </span>
  );
}

export default function InstallationPage() {
  return (
    <main className="min-h-screen">
      <Header />
      {/* Spacer for fixed header */}
      <div className="h-20" />
      
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e]">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#5865f2]/20 rounded-full border border-[#5865f2]/30 mb-6">
            <FaDiscord className="w-4 h-4 text-[#5865f2]" />
            <span className="text-sm text-[#5865f2]">Quick Setup</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 gradient-text">Add to Your Server</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Get Bypass Music Bot running in your Discord server in just 3 simple steps. No technical knowledge required!
          </p>
          
          {/* Main CTA */}
          <a 
            href="https://music-bot.checkleaked.com/invite"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl transition-all font-bold text-lg shadow-lg hover:shadow-[#5865f2]/25 hover:scale-105"
          >
            <FaDiscord className="w-6 h-6" />
            Invite Bot to Server
          </a>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-16 bg-[#0f0f23]">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-12 text-center">Setup in 3 Easy Steps</h2>
          
          <div className="space-y-8">
            {/* Step 1 */}
            <StepCard
              number={1}
              icon={<FaDiscord className="w-5 h-5" />}
              title="Invite the Bot"
              description="Click the invite button above or use the link below. You'll be redirected to Discord to authorize the bot."
            >
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm text-gray-500 mb-2">Invite URL:</p>
                <code className="text-green-400 text-sm break-all">https://music-bot.checkleaked.com/invite</code>
              </div>
            </StepCard>

            {/* Step 2 */}
            <StepCard
              number={2}
              icon={<FaUserShield className="w-5 h-5" />}
              title="Select Server & Authorize"
              description="Choose which server you want to add the bot to from the dropdown menu. You need 'Manage Server' permission to add bots."
            >
              <div className="space-y-3">
                <p className="text-sm text-gray-400">The bot will request these permissions:</p>
                <div className="flex flex-wrap gap-2">
                  <PermissionBadge name="Send Messages" />
                  <PermissionBadge name="Connect to Voice" />
                  <PermissionBadge name="Speak in Voice" />
                  <PermissionBadge name="Use Slash Commands" />
                  <PermissionBadge name="Embed Links" />
                </div>
              </div>
            </StepCard>

            {/* Step 3 */}
            <StepCard
              number={3}
              icon={<FaMusic className="w-5 h-5" />}
              title="Start Playing Music!"
              description="That's it! Join a voice channel and use /play to start listening to your favorite songs."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <code className="text-[#5865f2]">/play</code>
                  <p className="text-sm text-gray-500 mt-1">Play a song or playlist</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <code className="text-[#5865f2]">/help</code>
                  <p className="text-sm text-gray-500 mt-1">See all commands</p>
                </div>
              </div>
            </StepCard>
          </div>
        </div>
      </section>

      {/* Quick Commands Section */}
      <section className="py-16 bg-[#1a1a2e]">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#5865f2]/20 flex items-center justify-center">⚡</span>
            Essential Commands to Get Started
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
              <code className="text-lg text-[#5865f2] font-semibold">/play [song]</code>
              <p className="text-gray-400 mt-2">Play from YouTube, Spotify, SoundCloud, and more</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
              <code className="text-lg text-[#5865f2] font-semibold">/queue</code>
              <p className="text-gray-400 mt-2">View the current music queue</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
              <code className="text-lg text-[#5865f2] font-semibold">/skip</code>
              <p className="text-gray-400 mt-2">Skip to the next song in queue</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
              <code className="text-lg text-[#5865f2] font-semibold">/nowplaying</code>
              <p className="text-gray-400 mt-2">See what&apos;s currently playing</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
              <code className="text-lg text-[#5865f2] font-semibold">/volume [0-100]</code>
              <p className="text-gray-400 mt-2">Adjust the playback volume</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
              <code className="text-lg text-[#5865f2] font-semibold">/shuffle</code>
              <p className="text-gray-400 mt-2">Randomize the queue order</p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link 
              href="/commands"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-semibold"
            >
              View All 150+ Commands →
            </Link>
          </div>
        </div>
      </section>

      {/* Server Settings Section */}
      <section className="py-16 bg-[#0f0f23]">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-[#5865f2]/20 flex items-center justify-center">
              <FaCog className="w-4 h-4 text-[#5865f2]" />
            </span>
            Customize for Your Server
          </h2>

          <p className="text-gray-400 mb-6">
            Server administrators can customize the bot&apos;s behavior with the <code className="bg-white/10 px-2 py-1 rounded text-[#5865f2]">/settings</code> command:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h4 className="text-white font-semibold mb-2">🎭 DJ Role</h4>
              <p className="text-sm text-gray-400">Set a DJ role to control who can manage music playback</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h4 className="text-white font-semibold mb-2">🔊 Volume Limits</h4>
              <p className="text-sm text-gray-400">Set default and maximum volume levels</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h4 className="text-white font-semibold mb-2">📢 Announcements</h4>
              <p className="text-sm text-gray-400">Enable or disable now playing announcements</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h4 className="text-white font-semibold mb-2">🚫 Restricted Channels</h4>
              <p className="text-sm text-gray-400">Limit bot usage to specific voice or text channels</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h4 className="text-white font-semibold mb-2">🌍 Language</h4>
              <p className="text-sm text-gray-400">Change the bot&apos;s language for your server</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h4 className="text-white font-semibold mb-2">📋 Queue Settings</h4>
              <p className="text-sm text-gray-400">Set queue size limits and prevent duplicates</p>
            </div>
          </div>
        </div>
      </section>

      {/* Need Help Section */}
      <section className="py-16 bg-[#1a1a2e]">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Need Help?</h2>
          <p className="text-gray-400 mb-8">
            Having trouble setting up or using the bot? Join our support server!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/support" 
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl transition-colors font-semibold"
            >
              <FaDiscord className="w-5 h-5" />
              Join Discord Support
            </Link>
            <Link 
              href="/commands"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-semibold"
            >
              📖 Browse Commands
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
