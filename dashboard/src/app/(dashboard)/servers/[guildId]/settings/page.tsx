import type { Metadata } from "next";
import { SettingsScreen } from "@/components/fest/settings/SettingsScreen";

export const metadata: Metadata = { title: "Settings · Bypass" };

export default function Page() {
  return <SettingsScreen />;
}
