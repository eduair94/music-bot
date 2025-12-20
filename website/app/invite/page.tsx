"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function InvitePage() {
  const [countdown, setCountdown] = useState(3);

  const botClientId = "1315125264786653225";
  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${botClientId}&permissions=36700160&scope=bot%20applications.commands`;

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = inviteUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [inviteUrl]);

  return (
    <div className="min-h-screen bg-[#0f0f23] flex items-center justify-center">
      <div className="text-center px-4">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-[#5865f2] to-[#eb459e] flex items-center justify-center animate-pulse text-5xl">
            <span>&#x1F3B5;</span>
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="gradient-text">Adding Bypass</span>
        </h1>
        
        <p className="text-xl text-gray-400 mb-8">
          Redirecting you to Discord...
        </p>

        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 border-2 border-[#5865f2]">
            <span className="text-3xl font-bold text-[#5865f2]">{countdown}</span>
          </div>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-3 h-3 bg-[#5865f2] rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>

        <p className="text-gray-500 text-sm">
          Not redirecting?{" "}
          <a href={inviteUrl} className="text-[#5865f2] hover:underline">
            Click here to add Bypass
          </a>
        </p>

        <Link href="/" className="inline-block mt-6 text-gray-400 hover:text-white transition-colors">
          Back to home
        </Link>
      </div>

      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#5865f2]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#eb459e]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>
    </div>
  );
}
