import type { Metadata } from "next";
import { ActivityScreen } from "@/components/fest/activity/ActivityScreen";

export const metadata: Metadata = { title: "Activity · Bypass" };

export default function Page() {
  return <ActivityScreen />;
}
