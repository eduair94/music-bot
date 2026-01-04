"use client";

import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Typography,
  InputAdornment,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import MicIcon from "@mui/icons-material/Mic";
import type { DiscordChannel, BotCommandType, BotCommandParams } from "@/types/discord";

interface AddSongProps {
  voiceChannels: DiscordChannel[];
  currentVoiceChannelId: string | null;
  sendCommand: (command: BotCommandType, params?: BotCommandParams) => Promise<{ success: boolean; error?: string }>;
  sendingCommand: boolean;
}

export function AddSong({ 
  voiceChannels, 
  currentVoiceChannelId, 
  sendCommand, 
  sendingCommand 
}: AddSongProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  
  const [query, setQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(currentVoiceChannelId || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePlay = async () => {
    if (!query.trim()) {
      setError("Please enter a song name or URL");
      return;
    }

    setError(null);
    setSuccess(null);

    const params: BotCommandParams = {
      query: query.trim(),
    };

    // Include voice channel if not already connected
    if (!currentVoiceChannelId && selectedChannel) {
      params.voiceChannelId = selectedChannel;
    }

    const result = await sendCommand("play", params);

    if (result.success) {
      setSuccess("Song added to queue!");
      setQuery("");
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Failed to add song");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !sendingCommand) {
      handlePlay();
    }
  };

  return (
    <Card sx={{ 
      background: "rgba(22, 33, 62, 0.6)", 
      border: "1px solid rgba(255, 255, 255, 0.1)" 
    }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Add Song
        </Typography>

        <Stack spacing={2}>
          {/* Voice Channel Selection (only show if not connected) */}
          {!currentVoiceChannelId && voiceChannels.length > 0 && (
            <FormControl fullWidth size="small">
              <InputLabel>Voice Channel</InputLabel>
              <Select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                label="Voice Channel"
                startAdornment={
                  <InputAdornment position="start">
                    <MicIcon fontSize="small" />
                  </InputAdornment>
                }
              >
                {voiceChannels.map((channel) => (
                  <MenuItem key={channel.id} value={channel.id}>
                    {channel.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Song Input */}
          <TextField
            fullWidth
            placeholder="Song name, YouTube URL, Spotify URL..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sendingCommand}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          {/* Play Button */}
          <Button
            variant="contained"
            fullWidth
            onClick={handlePlay}
            disabled={sendingCommand || !query.trim() || (!currentVoiceChannelId && !selectedChannel)}
            startIcon={sendingCommand ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
            sx={{ py: 1.5 }}
          >
            {sendingCommand ? "Adding..." : "Play"}
          </Button>

          {/* Error/Success Messages */}
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* Help Text */}
          <Typography variant="caption" color="text.secondary">
            Supports YouTube, Spotify, SoundCloud, and direct audio URLs
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
