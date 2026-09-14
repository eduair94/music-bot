import AdminConsole from "@/components/admin/AdminConsole";
import { isOwnerSession } from "@/lib/admin-auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false }
};

export default async function AdminPage() {
  if (!(await isOwnerSession())) redirect("/dashboard");
  return <AdminConsole />;
}
