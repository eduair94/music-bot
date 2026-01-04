import { auth } from "@/auth";
import { ServerSettingsForm } from "@/components/dashboard/ServerSettingsForm";
import { fetchGuildChannels, fetchGuildRoles, fetchUserGuilds, hasManagePermission, isBotInGuild } from "@/lib/discord";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { connectToDatabase } from "@/lib/mongodb";
import type { DiscordChannel, DiscordRole, GuildSettings } from "@/types/discord";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { Box, Breadcrumbs, Link as MuiLink, Typography } from "@mui/material";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

// Force dynamic rendering - this page needs runtime data
export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ guildId: string }>;
}

async function getGuildSettings(guildId: string): Promise<GuildSettings | null> {
  try {
    await connectToDatabase();
    const settings = await GuildSettingsModel.findOne({ guildId }).lean();
    return settings as GuildSettings | null;
  } catch (error) {
    console.error("Error fetching guild settings:", error);
    return null;
  }
}

export default async function ServerSettingsPage({ params }: Props) {
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

  // Fetch guild data
  let channels: DiscordChannel[] = [];
  let roles: DiscordRole[] = [];
  let settings: GuildSettings | null = null;

  try {
    [channels, roles, settings] = await Promise.all([
      fetchGuildChannels(guildId),
      fetchGuildRoles(guildId),
      getGuildSettings(guildId),
    ]);
  } catch (error) {
    console.error("Error fetching guild data:", error);
  }

  // Filter channels by type (voice: 2, text: 0)
  const voiceChannels = channels.filter((c) => c.type === 2);
  const textChannels = channels.filter((c) => c.type === 0);

  // Filter out managed roles and @everyone
  const assignableRoles = roles.filter((r) => !r.managed && r.name !== "@everyone");

  // Default settings if none exist
  const defaultSettings: GuildSettings = {
    guildId,
    allowedVoiceChannels: [],
    allowedTextChannels: [],
    logChannelId: null,
    djRoleId: null,
    adminRoleId: null,
    defaultVolume: 80,
    maxVolume: 100,
    maxQueueSize: 100,
    maxSongDuration: 0,
    announceNowPlaying: true,
    autoLeaveEmpty: true,
    autoLeaveTimeout: 300,
    preventDuplicates: false,
    premium: {
      enabled: false,
      tier: "free",
      expiresAt: null,
      maxConcurrentListeners: 0,
      customBranding: false,
      prioritySupport: false,
      analytics: false,
    },
    blacklistedUsers: [],
    blacklistedSongs: [],
    language: "en",
    embedColor: "#F8AA2A",
    totalSongsPlayed: 0,
    totalPlaytime: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const currentSettings = settings || defaultSettings;

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
        <Typography color="text.primary">{guild.name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Server Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure the music bot for {guild.name}
        </Typography>
      </Box>

      {/* Settings Form */}
      <ServerSettingsForm
        guildId={guildId}
        settings={currentSettings}
        voiceChannels={voiceChannels}
        textChannels={textChannels}
        roles={assignableRoles}
      />
    </Box>
  );
}
