"use client";

import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Tooltip,
  Stack,
  Chip,
  Divider,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import QueueMusicIcon from "@mui/icons-material/QueueMusic";
import type { Track, BotCommandType, BotCommandParams } from "@/types/discord";

interface QueueListProps {
  queue: Track[];
  currentTrack: Track | null;
  sendCommand: (command: BotCommandType, params?: BotCommandParams) => Promise<{ success: boolean; error?: string }>;
  sendingCommand: boolean;
}

function formatDuration(ms: number): string {
  if (!ms || isNaN(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getSourceColor(source: Track["source"]): string {
  switch (source) {
    case "youtube": return "#FF0000";
    case "spotify": return "#1DB954";
    case "soundcloud": return "#FF5500";
    default: return "#888888";
  }
}

function getSourceLabel(source: Track["source"]): string {
  switch (source) {
    case "youtube": return "YouTube";
    case "spotify": return "Spotify";
    case "soundcloud": return "SoundCloud";
    case "file": return "File";
    default: return "Unknown";
  }
}

export function QueueList({ queue, currentTrack, sendCommand, sendingCommand }: QueueListProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleRemove = (position: number) => {
    sendCommand("remove", { position });
  };

  const handleSkipTo = (position: number) => {
    sendCommand("skipto", { position });
  };

  const totalDuration = queue.reduce((acc, track) => acc + (track.duration || 0), 0);

  if (queue.length === 0 && !currentTrack) {
    return (
      <Card sx={{ 
        background: "rgba(22, 33, 62, 0.6)", 
        border: "1px solid rgba(255, 255, 255, 0.1)" 
      }}>
        <CardContent sx={{ textAlign: "center", py: 4 }}>
          <QueueMusicIcon sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
          <Typography color="text.secondary">
            Queue is empty
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Add some songs to get started!
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
      <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
        {/* Header */}
        <Stack 
          direction="row" 
          justifyContent="space-between" 
          alignItems="center" 
          sx={{ mb: 2, px: 1 }}
        >
          <Typography variant="h6" fontWeight={600}>
            Queue
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip 
              label={`${queue.length + (currentTrack ? 1 : 0)} songs`} 
              size="small" 
              variant="outlined" 
            />
            <Chip 
              label={formatDuration(totalDuration + (currentTrack?.duration || 0))} 
              size="small" 
              variant="outlined" 
            />
          </Stack>
        </Stack>

        <Divider sx={{ mb: 1 }} />

        {/* Now Playing */}
        {currentTrack && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="overline" color="primary.main" sx={{ px: 1 }}>
              Now Playing
            </Typography>
            <ListItem
              sx={{
                bgcolor: "rgba(88, 101, 242, 0.1)",
                borderRadius: 1,
                border: "1px solid rgba(88, 101, 242, 0.3)",
              }}
            >
              <ListItemAvatar>
                <Avatar 
                  src={currentTrack.thumbnail} 
                  variant="rounded"
                  sx={{ width: 48, height: 48 }}
                >
                  <QueueMusicIcon />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight={500} noWrap>
                    {currentTrack.title}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.secondary" component="span">
                    {currentTrack.author} • {formatDuration(currentTrack.duration)}
                  </Typography>
                }
              />
              <Chip
                label={getSourceLabel(currentTrack.source)}
                size="small"
                sx={{ 
                  bgcolor: getSourceColor(currentTrack.source),
                  color: "white",
                  fontSize: "0.65rem",
                  height: 20,
                }}
              />
            </ListItem>
          </Box>
        )}

        {/* Up Next */}
        {queue.length > 0 && (
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>
              Up Next
            </Typography>
            <List dense disablePadding>
              {queue.map((track, index) => (
                <ListItem
                  key={`${track.url}-${index}`}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    "&:hover": {
                      bgcolor: "rgba(255, 255, 255, 0.05)",
                    },
                  }}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      {!isMobile && (
                        <Tooltip title="Skip to this track">
                          <IconButton 
                            size="small" 
                            onClick={() => handleSkipTo(index + 1)}
                            disabled={sendingCommand}
                          >
                            <PlayArrowIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Remove from queue">
                        <IconButton 
                          size="small" 
                          onClick={() => handleRemove(index + 1)}
                          disabled={sendingCommand}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }
                >
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ minWidth: 24, mr: 1 }}
                  >
                    {index + 1}
                  </Typography>
                  <ListItemAvatar>
                    <Avatar 
                      src={track.thumbnail} 
                      variant="rounded"
                      sx={{ width: 40, height: 40 }}
                    >
                      <QueueMusicIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography 
                        variant="body2" 
                        noWrap 
                        sx={{ maxWidth: { xs: 150, sm: 250, md: 350 } }}
                      >
                        {track.title}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" component="span" noWrap>
                        {track.author}
                        {!isMobile && (
                          <> • {formatDuration(track.duration)} • {track.requestedBy.username}</>
                        )}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
