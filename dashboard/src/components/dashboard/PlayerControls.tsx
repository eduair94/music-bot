"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Card,
  CardContent,
  IconButton,
  Typography,
  Slider,
  Stack,
  Avatar,
  Chip,
  Tooltip,
  CircularProgress,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import SkipPreviousIcon from "@mui/icons-material/SkipPrevious";
import StopIcon from "@mui/icons-material/Stop";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeDownIcon from "@mui/icons-material/VolumeDown";
import VolumeMuteIcon from "@mui/icons-material/VolumeMute";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import RepeatIcon from "@mui/icons-material/Repeat";
import RepeatOneIcon from "@mui/icons-material/RepeatOne";
import QueueMusicIcon from "@mui/icons-material/QueueMusic";
import MicIcon from "@mui/icons-material/Mic";
import type { PlaybackState, BotCommandType, BotCommandParams } from "@/types/discord";

interface PlayerControlsProps {
  state: PlaybackState;
  sendCommand: (command: BotCommandType, params?: BotCommandParams) => Promise<{ success: boolean; error?: string }>;
  sendingCommand: boolean;
  compact?: boolean;
}

function formatDuration(ms: number): string {
  if (!ms || isNaN(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function PlayerControls({ 
  state, 
  sendCommand, 
  sendingCommand,
  compact = false 
}: PlayerControlsProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [localVolume, setLocalVolume] = useState(state.volume);
  const [displayPosition, setDisplayPosition] = useState(state.currentPosition);
  const lastUpdateRef = useRef<number>(Date.now());

  // Update display position in real-time when playing
  useEffect(() => {
    // Reset position when state changes from server
    setDisplayPosition(state.currentPosition);
    lastUpdateRef.current = Date.now();
  }, [state.currentPosition, state.lastUpdated]);

  useEffect(() => {
    if (!state.isPlaying || state.isPaused || !state.currentTrack) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastUpdateRef.current;
      const newPosition = state.currentPosition + elapsed;
      const maxDuration = state.currentTrack?.duration || 0;
      
      // Don't exceed track duration
      setDisplayPosition(Math.min(newPosition, maxDuration));
    }, 1000);

    return () => clearInterval(interval);
  }, [state.isPlaying, state.isPaused, state.currentPosition, state.currentTrack]);

  const handlePlayPause = () => {
    if (state.isPaused) {
      sendCommand("resume");
    } else {
      sendCommand("pause");
    }
  };

  const handleStop = () => sendCommand("stop");
  const handleSkip = () => sendCommand("skip");
  const handleShuffle = () => sendCommand("shuffle");
  
  const handleLoop = () => {
    const modes: Array<"off" | "track" | "queue"> = ["off", "track", "queue"];
    const currentIndex = modes.indexOf(state.loopMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    sendCommand("loop", { loopMode: nextMode });
  };

  const handleVolumeChange = (_: Event, value: number | number[]) => {
    const vol = value as number;
    setLocalVolume(vol);
  };

  const handleVolumeCommit = (_: Event | React.SyntheticEvent, value: number | number[]) => {
    sendCommand("volume", { volume: value as number });
  };

  const getLoopIcon = () => {
    switch (state.loopMode) {
      case "track":
        return <RepeatOneIcon />;
      case "queue":
        return <RepeatIcon color="primary" />;
      default:
        return <RepeatIcon />;
    }
  };

  const getVolumeIcon = () => {
    if (localVolume === 0) return <VolumeMuteIcon />;
    if (localVolume < 50) return <VolumeDownIcon />;
    return <VolumeUpIcon />;
  };

  // Progress calculation using displayPosition for smooth updates
  const progress = state.currentTrack 
    ? (displayPosition / state.currentTrack.duration) * 100 
    : 0;

  if (!state.isConnected && !state.currentTrack) {
    return (
      <Card sx={{ 
        background: "rgba(22, 33, 62, 0.6)", 
        border: "1px solid rgba(255, 255, 255, 0.1)" 
      }}>
        <CardContent sx={{ textAlign: "center", py: 4 }}>
          <MicIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
          <Typography color="text.secondary">
            Not connected to any voice channel
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Use the /play command in Discord or add a song below
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ 
      background: "rgba(22, 33, 62, 0.6)", 
      border: "1px solid rgba(255, 255, 255, 0.1)" 
    }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Now Playing */}
        <Stack 
          direction={{ xs: "column", sm: "row" }} 
          spacing={2} 
          alignItems={{ xs: "center", sm: "flex-start" }}
        >
          {/* Album Art */}
          <Avatar
            src={state.currentTrack?.thumbnail}
            variant="rounded"
            sx={{ 
              width: { xs: 120, sm: 80, md: 100 }, 
              height: { xs: 120, sm: 80, md: 100 },
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
            }}
          >
            <QueueMusicIcon sx={{ fontSize: 40 }} />
          </Avatar>

          {/* Track Info */}
          <Box sx={{ flex: 1, minWidth: 0, textAlign: { xs: "center", sm: "left" }, width: "100%" }}>
            <Typography 
              variant="subtitle1" 
              fontWeight={600} 
              noWrap 
              title={state.currentTrack?.title}
            >
              {state.currentTrack?.title || "No track playing"}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {state.currentTrack?.author || "Unknown artist"}
            </Typography>
            
            {/* Progress Bar */}
            <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 35 }}>
                {formatDuration(displayPosition)}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={progress}
                sx={{ 
                  flex: 1, 
                  height: 4, 
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.1)",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: "primary.main"
                  }
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 35, textAlign: "right" }}>
                {formatDuration(state.currentTrack?.duration || 0)}
              </Typography>
            </Box>

            {/* Status Chips */}
            <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: { xs: "center", sm: "flex-start" } }} flexWrap="wrap">
              {state.voiceChannelName && (
                <Chip 
                  icon={<MicIcon />} 
                  label={state.voiceChannelName} 
                  size="small" 
                  variant="outlined"
                />
              )}
              {state.loopMode !== "off" && (
                <Chip 
                  icon={state.loopMode === "track" ? <RepeatOneIcon /> : <RepeatIcon />}
                  label={state.loopMode === "track" ? "Repeat Track" : "Repeat Queue"}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              <Chip 
                label={`${state.queueSize} up next`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Box>
        </Stack>

        {/* Controls */}
        <Stack 
          direction="row" 
          justifyContent="center" 
          alignItems="center" 
          spacing={{ xs: 0.5, sm: 1 }}
          sx={{ mt: 2 }}
        >
          <Tooltip title="Shuffle">
            <IconButton onClick={handleShuffle} disabled={sendingCommand} size={isMobile ? "small" : "medium"}>
              <ShuffleIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Skip Previous (Not implemented)">
            <span>
              <IconButton disabled size={isMobile ? "small" : "medium"}>
                <SkipPreviousIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={state.isPaused ? "Resume" : "Pause"}>
            <IconButton 
              onClick={handlePlayPause} 
              disabled={sendingCommand || !state.currentTrack}
              sx={{ 
                bgcolor: "primary.main", 
                color: "white",
                "&:hover": { bgcolor: "primary.dark" },
                width: { xs: 48, sm: 56 },
                height: { xs: 48, sm: 56 },
              }}
            >
              {sendingCommand ? (
                <CircularProgress size={24} color="inherit" />
              ) : state.isPaused ? (
                <PlayArrowIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
              ) : (
                <PauseIcon sx={{ fontSize: { xs: 28, sm: 32 } }} />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title="Skip">
            <IconButton onClick={handleSkip} disabled={sendingCommand || !state.currentTrack} size={isMobile ? "small" : "medium"}>
              <SkipNextIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title={`Loop: ${state.loopMode}`}>
            <IconButton onClick={handleLoop} disabled={sendingCommand} size={isMobile ? "small" : "medium"}>
              {getLoopIcon()}
            </IconButton>
          </Tooltip>

          <Tooltip title="Stop">
            <IconButton onClick={handleStop} disabled={sendingCommand} color="error" size={isMobile ? "small" : "medium"}>
              <StopIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Volume Control */}
        <Stack 
          direction="row" 
          alignItems="center" 
          spacing={2} 
          sx={{ mt: 2, px: { xs: 0, sm: 2 } }}
        >
          <IconButton size="small" sx={{ color: "text.secondary" }}>
            {getVolumeIcon()}
          </IconButton>
          <Slider
            value={localVolume}
            onChange={handleVolumeChange}
            onChangeCommitted={handleVolumeCommit}
            min={0}
            max={100}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}%`}
            sx={{ flex: 1 }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
            {localVolume}%
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
