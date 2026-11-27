import { auth } from "@/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CollectionsClient } from "./CollectionsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Collections" };

const DEMO = process.env.NEXT_PUBLIC_DASH_DEMO === "1";

export default async function CollectionsPage() {
  const session = await auth();
  if (!session && !DEMO) redirect("/login");

  return <CollectionsClient demo={!session} />;
}
