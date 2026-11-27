import { AddSongDrawer } from "@/components/fest/AddSongDrawer";
import { GuildGate } from "@/components/fest/GuildGate";
import { GuildLiveProvider } from "@/lib/dash/live";

export const dynamic = "force-dynamic";

export default async function GuildLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  return (
    <GuildLiveProvider guildId={guildId}>
      <GuildGate>{children}</GuildGate>
      <AddSongDrawer />
    </GuildLiveProvider>
  );
}
