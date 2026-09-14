import { adminJson, requireOwner } from "@/lib/admin-auth";
import { debugPanelConfigured, fetchDebugPanel } from "@/lib/admin/debug-panel";

export const dynamic = "force-dynamic";

const LEVELS = new Set(["log", "info", "warn", "error", "debug"]);

export async function GET(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  if (!debugPanelConfigured()) return adminJson({ error: "not_configured" }, 501);

  const url = new URL(request.url);
  const last = Math.min(1000, Math.max(1, Number(url.searchParams.get("last")) || 200));
  const level = url.searchParams.get("level") || "";
  const search = (url.searchParams.get("search") || "").slice(0, 200);

  const qs = new URLSearchParams({ last: String(last) });
  if (LEVELS.has(level)) qs.set("level", level);
  if (search) qs.set("search", search);

  try {
    const res = await fetchDebugPanel(`/api/logs?${qs.toString()}`);
    if (!res.ok) return adminJson({ error: `Debug panel responded ${res.status}` }, 502);
    const entries = await res.json();
    return adminJson({ entries });
  } catch (error) {
    console.error("[admin/logs] debug panel unreachable:", error);
    return adminJson({ error: "Debug panel unreachable" }, 502);
  }
}
