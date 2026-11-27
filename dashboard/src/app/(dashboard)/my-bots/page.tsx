import { auth } from "@/auth";
import { MyBots } from "@/components/fest/account/MyBots";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Your own bots" };

const DEMO = process.env.NEXT_PUBLIC_DASH_DEMO === "1";

export default async function MyBotsPage() {
  const session = await auth();
  if (!session && !DEMO) redirect("/login");

  return <MyBots demo={!session} />;
}
