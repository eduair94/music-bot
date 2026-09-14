/**
 * Commands Page
 *
 * Full page listing all bot commands with filtering and search
 */

import Commands from "@/components/landing/Commands";
import { COMMAND_COUNT } from "@/data/commands";
import { Metadata } from "next";

const description = `Browse all ${COMMAND_COUNT} Bypass slash commands: play music from YouTube and Spotify, manage the queue, apply audio filters, fetch lyrics, and configure your server.`;

export const metadata: Metadata = {
  title: "Commands",
  description,
  alternates: { canonical: "/commands" },
  openGraph: {
    title: "Bypass Commands",
    description,
    url: "/commands",
  },
};

export default function CommandsPage() {
  return (
    <div className="pt-20">
      <Commands headingLevel="h1" />
    </div>
  );
}
