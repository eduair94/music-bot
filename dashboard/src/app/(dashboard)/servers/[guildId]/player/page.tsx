import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { fetchUserGuilds, hasManagePermission, fetchGuildChannels } from "@/lib/discord";
import { isBotInGuild } from "@/lib/discord-server";
import { Box, Typography, Breadcrumbs, Link as MuiLink, Button } from "@mui/material";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import SettingsIcon from "@mui/icons-material/Settings";
import Link from "next/link";
import { PlayerPageClient } from "./PlayerPageClient";
import type { DiscordChannel } from "@/types/discord";

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ guildId: string }>;
}

export default async function PlayerPage({ params }: Props) {
  const session = await auth();
  const { guildId } = await params;

  if (!session?.accessToken) {
    redirect("/login");
  }

  // Verify user has permission to manage this guild
  const guilds = await fetchUserGuilds(session.accessToken);
  const guild = guilds.find((g) => g.id === guildId);

  if (!guild || !hasManagePermission(guild.permissions)) {
    notFound();
  }

  // Check if bot is in guild
  const botInGuild = await isBotInGuild(guildId);
  if (!botInGuild) {
    notFound();
  }

  // Fetch voice channels
  let channels: DiscordChannel[] = [];
  try {
    const allChannels = await fetchGuildChannels(guildId);
    channels = allChannels.filter((c) => c.type === 2); // Voice channels only
  } catch (error) {
    console.error("Error fetching channels:", error);
  }

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        sx={{ mb: 3 }}
      >
        <MuiLink
          component={Link}
          href="/servers"
          underline="hover"
          color="text.secondary"
        >
          Servers
        </MuiLink>
        <MuiLink
          component={Link}
          href={`/servers/${guildId}/player`}
          underline="hover"
          color="text.secondary"
        >
          {guild.name}
        </MuiLink>
        <Typography color="text.primary">Player</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: { xs: "flex-start", sm: "center" },
        flexDirection: { xs: "column", sm: "row" },
        gap: 2,
        mb: 4 
      }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Music Player
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Control the music bot for {guild.name}
          </Typography>
        </Box>
        <Button
          component={Link}
          href={`/servers/${guildId}/settings`}
          variant="outlined"
          startIcon={<SettingsIcon />}
        >
          Settings
        </Button>
      </Box>

      {/* Client-side Player */}
      <PlayerPageClient guildId={guildId} voiceChannels={channels} />
    </Box>
  );
}
