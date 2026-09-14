import "server-only";

export function debugPanelConfigured(): boolean {
  return !!(process.env.DEBUG_PANEL_URL && process.env.DEBUG_TOKEN);
}

/** Server-side call to the bot DebugPanel; the token never reaches the browser. */
export async function fetchDebugPanel(path: string, timeoutMs = 3000): Promise<Response> {
  const base = (process.env.DEBUG_PANEL_URL || "").replace(/\/$/, "");
  const url = new URL(base + path);
  url.searchParams.set("token", process.env.DEBUG_TOKEN || "");
  return fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
}
