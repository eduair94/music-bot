import { adminJson, requireOwner } from "@/lib/admin-auth";
import { listAudit } from "@/lib/admin/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 50));
  try {
    return adminJson({ entries: await listAudit(limit) });
  } catch (error) {
    console.error("[admin/audit] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
