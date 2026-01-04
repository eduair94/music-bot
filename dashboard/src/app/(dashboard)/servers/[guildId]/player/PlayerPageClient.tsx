"use client";

import { AddSong } from "@/components/dashboard/AddSong";
import { PlayerControls } from "@/components/dashboard/PlayerControls";
import { QueueList } from "@/components/dashboard/QueueList";
import { usePlayback } from "@/hooks/usePlayback";
import type { DiscordChannel, PlaybackState } from "@/types/discord";
import { Alert, Box, Grid2 as Grid, Skeleton, Stack } from "@mui/material";

interface PlayerPageClientProps {
  guildId: string;
  voiceChannels: DiscordChannel[];
}

export function PlayerPageClient({ guildId, voiceChannels }: PlayerPageClientProps) {
  const { state, loading, error, sendCommand, sendingCommand, refresh } = usePlayback({
    guildId,
    pollingInterval: 2000,
  });

  if (loading) {
    return (
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Skeleton variant="rounded" height={250} />
          <Box sx={{ mt: 3 }}>
            <Skeleton variant="rounded" height={400} />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Skeleton variant="rounded" height={200} />
        </Grid>
      </Grid>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load playback state: {error}
      </Alert>
    );
  }

  // Default state when no playback state exists yet
  const defaultState: PlaybackState = {
    guildId,
    isConnected: false,
    voiceChannelId: null,
    voiceChannelName: null,
    textChannelId: null,
    isPlaying: false,
    isPaused: false,
    volume: 100,
    currentTrack: null,
    currentPosition: 0,
    queue: [],
    queueSize: 0,
    loopMode: "off",
    audioBitrate: 96,
    lastUpdated: new Date(),
    playbackStartedAt: null,
  };

  const currentState = state || defaultState;

  return (
    <Grid container spacing={3}>
      {/* Main Content */}
      <Grid size={{ xs: 12, lg: 8 }}>
        <Stack spacing={3}>
          {/* Player Controls */}
          <PlayerControls
            state={currentState}
            sendCommand={sendCommand}
            sendingCommand={sendingCommand}
          />

          {/* Queue */}
          <QueueList
            queue={currentState.queue}
            currentTrack={currentState.currentTrack}
            sendCommand={sendCommand}
            sendingCommand={sendingCommand}
          />
        </Stack>
      </Grid>

      {/* Sidebar */}
      <Grid size={{ xs: 12, lg: 4 }}>
        <Stack spacing={3}>
          {/* Add Song */}
          <AddSong
            voiceChannels={voiceChannels}
            currentVoiceChannelId={currentState.voiceChannelId}
            sendCommand={sendCommand}
            sendingCommand={sendingCommand}
          />
        </Stack>
      </Grid>
    </Grid>
  );
}
