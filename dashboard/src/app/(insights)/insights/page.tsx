import { hasAdminAccess } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import InsightsClient from "./InsightsClient";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  if (!(await hasAdminAccess())) {
    redirect("/insights/login");
  }
  return <InsightsClient />;
}
