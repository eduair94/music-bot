import { adminJson, requireOwner } from "@/lib/admin-auth";
import { loadOverview } from "@/lib/admin/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  try {
    return adminJson(await loadOverview());
  } catch (error) {
    console.error("[admin/overview] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
