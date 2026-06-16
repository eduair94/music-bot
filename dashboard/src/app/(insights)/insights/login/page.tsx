"use client";

import BrandMark from "@/components/common/BrandMark";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function InsightsLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/insights");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Incorrect password.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-coal text-cream font-sans flex items-center justify-center raster px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <BrandMark size={52} />
          <div className="console-label text-amber! mt-5">Insights · Admin</div>
          <h1 className="font-display text-3xl font-bold tracking-tight mt-2">
            Restricted console
          </h1>
          <p className="text-dune text-sm mt-2">
            Enter the admin password to view growth and user analytics.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="console-panel rounded-xl p-6">
          <label className="console-label block mb-2">Password</label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-panel border border-line rounded-lg font-mono text-cream placeholder-dust focus:outline-none focus:border-amber/60 transition-colors"
            placeholder="••••••"
          />

          {error && (
            <p className="mt-3 text-sm text-clip font-mono">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="mt-5 w-full py-3 bg-amber hover:bg-amber-hot disabled:opacity-50 disabled:cursor-not-allowed text-coal font-semibold rounded-lg transition-colors"
          >
            {loading ? "Verifying…" : "Unlock insights"}
          </button>
        </form>

        <p className="text-center text-dust text-xs mt-6 font-mono">
          Authorized personnel only
        </p>
      </div>
    </div>
  );
}
