"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  IconButton,
  Chip,
  Grid2,
  Avatar,
  CircularProgress,
  Skeleton,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DeleteIcon from "@mui/icons-material/Delete";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import RefreshIcon from "@mui/icons-material/Refresh";
import { BotStatus } from "@/lib/models/LinkedBot";

interface LinkedBot {
  _id: string;
  botId: string;
  botUsername: string;
  botAvatar: string | null;
  status: BotStatus;
  lastStatusChange: string;
  lastError: string | null;
  totalGuilds: number;
  totalSongsPlayed: number;
  createdAt: string;
}

interface BotsResponse {
  bots: LinkedBot[];
  tier: string;
  limit: number;
  count: number;
  canLinkMore: boolean;
}

const statusColors: Record<BotStatus, "success" | "warning" | "error" | "default"> = {
  online: "success",
  starting: "warning",
  offline: "default",
  error: "error",
  stopped: "default",
};

const statusLabels: Record<BotStatus, string> = {
  online: "Online",
  starting: "Starting...",
  offline: "Offline",
  error: "Error",
  stopped: "Stopped",
};

export default function MyBotsPage() {
  const [data, setData] = useState<BotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [newBotToken, setNewBotToken] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBots = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/user/bots");
      if (!response.ok) {
        throw new Error("Failed to fetch bots");
      }
      const result: BotsResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch bots");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const handleLinkBot = async () => {
    if (!newBotToken.trim()) {
      setLinkError("Please enter a bot token");
      return;
    }

    try {
      setLinking(true);
      setLinkError(null);

      const response = await fetch("/api/user/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: newBotToken }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to link bot");
      }

      setNewBotToken("");
      setLinkDialogOpen(false);
      fetchBots();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Failed to link bot");
    } finally {
      setLinking(false);
    }
  };

  const handleBotAction = async (botId: string, action: "start" | "stop" | "restart") => {
    try {
      setActionLoading(`${botId}-${action}`);

      const response = await fetch(`/api/user/bots/${botId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to ${action} bot`);
      }

      // Refresh bots after action
      setTimeout(() => fetchBots(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} bot`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteBot = async (botId: string) => {
    if (!confirm("Are you sure you want to unlink this bot? This will stop the bot if running.")) {
      return;
    }

    try {
      setActionLoading(`${botId}-delete`);

      const response = await fetch(`/api/user/bots/${botId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to unlink bot");
      }

      fetchBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unlink bot");
    } finally {
      setActionLoading(null);
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case "enterprise": return "Enterprise";
      case "pro": return "Pro";
      case "basic": return "Basic";
      default: return "Free";
    }
  };

  if (loading && !data) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={700} mb={3}>
          My Bots
        </Typography>
        <Grid2 container spacing={3}>
          {[1, 2].map((i) => (
            <Grid2 key={i} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ bgcolor: "rgba(255,255,255,0.05)" }}>
                <CardContent>
                  <Skeleton variant="circular" width={64} height={64} />
                  <Skeleton variant="text" sx={{ mt: 2 }} />
                  <Skeleton variant="text" width="60%" />
                </CardContent>
              </Card>
            </Grid2>
          ))}
        </Grid2>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            My Bots
          </Typography>
          <Typography color="text.secondary">
            Link and manage your own Discord bots • {data?.count || 0} / {data?.limit || 0} bots ({getTierLabel(data?.tier || "free")})
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchBots} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setLinkDialogOpen(true)}
            disabled={!data?.canLinkMore}
          >
            Link Bot
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Free tier notice */}
      {data?.tier === "free" && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Upgrade to a paid tier to link your own Discord bots.{" "}
          <Button href="/premium" size="small" color="inherit">
            View Plans
          </Button>
        </Alert>
      )}

      {/* Bots Grid */}
      {data?.bots.length === 0 ? (
        <Card sx={{ bgcolor: "rgba(255,255,255,0.05)", p: 4, textAlign: "center" }}>
          <SmartToyIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No bots linked yet
          </Typography>
          <Typography color="text.secondary" mb={2}>
            {data?.canLinkMore
              ? "Link your own Discord bot to run it with our music player."
              : "Upgrade your plan to link your own bots."}
          </Typography>
          {data?.canLinkMore && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setLinkDialogOpen(true)}>
              Link Your First Bot
            </Button>
          )}
        </Card>
      ) : (
        <Grid2 container spacing={3}>
          {data?.bots.map((bot) => (
            <Grid2 key={bot.botId} size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ bgcolor: "rgba(255,255,255,0.05)", height: "100%" }}>
                <CardContent>
                  {/* Bot Header */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                    <Avatar
                      src={bot.botAvatar ? `https://cdn.discordapp.com/avatars/${bot.botId}/${bot.botAvatar}.png` : undefined}
                      sx={{ width: 56, height: 56, bgcolor: "primary.main" }}
                    >
                      <SmartToyIcon />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" noWrap>
                        {bot.botUsername}
                      </Typography>
                      <Chip
                        label={statusLabels[bot.status]}
                        color={statusColors[bot.status]}
                        size="small"
                      />
                    </Box>
                  </Box>

                  {/* Error message */}
                  {bot.lastError && (
                    <Alert severity="error" sx={{ mb: 2, py: 0 }}>
                      <Typography variant="caption">{bot.lastError}</Typography>
                    </Alert>
                  )}

                  {/* Stats */}
                  <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Servers
                      </Typography>
                      <Typography variant="h6">{bot.totalGuilds}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Songs Played
                      </Typography>
                      <Typography variant="h6">{bot.totalSongsPlayed}</Typography>
                    </Box>
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {bot.status === "online" || bot.status === "starting" ? (
                      <Button
                        variant="outlined"
                        color="warning"
                        size="small"
                        startIcon={
                          actionLoading === `${bot.botId}-stop` ? (
                            <CircularProgress size={16} />
                          ) : (
                            <StopIcon />
                          )
                        }
                        onClick={() => handleBotAction(bot.botId, "stop")}
                        disabled={!!actionLoading}
                      >
                        Stop
                      </Button>
                    ) : (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={
                          actionLoading === `${bot.botId}-start` ? (
                            <CircularProgress size={16} />
                          ) : (
                            <PlayArrowIcon />
                          )
                        }
                        onClick={() => handleBotAction(bot.botId, "start")}
                        disabled={!!actionLoading}
                      >
                        Start
                      </Button>
                    )}
                    <Tooltip title="Restart">
                      <IconButton
                        size="small"
                        onClick={() => handleBotAction(bot.botId, "restart")}
                        disabled={!!actionLoading || bot.status === "offline"}
                      >
                        {actionLoading === `${bot.botId}-restart` ? (
                          <CircularProgress size={16} />
                        ) : (
                          <RestartAltIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Unlink Bot">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteBot(bot.botId)}
                        disabled={!!actionLoading}
                      >
                        {actionLoading === `${bot.botId}-delete` ? (
                          <CircularProgress size={16} />
                        ) : (
                          <DeleteIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardContent>
              </Card>
            </Grid2>
          ))}
        </Grid2>
      )}

      {/* Link Bot Dialog */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link a New Bot</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" gutterBottom>
            Enter your Discord bot token to link it. The bot will run as a music bot with all the same features.
          </Typography>
          <Alert severity="warning" sx={{ my: 2 }}>
            <Typography variant="body2">
              <strong>Important:</strong> Never share your bot token publicly. We encrypt and securely store your token.
            </Typography>
          </Alert>
          <TextField
            fullWidth
            label="Bot Token"
            type="password"
            placeholder="Enter your bot token..."
            value={newBotToken}
            onChange={(e) => setNewBotToken(e.target.value)}
            error={!!linkError}
            helperText={linkError}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLinkBot}
            disabled={linking || !newBotToken.trim()}
            startIcon={linking ? <CircularProgress size={16} /> : <AddIcon />}
          >
            {linking ? "Linking..." : "Link Bot"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
