"use client";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import GroupsIcon from "@mui/icons-material/Groups";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SettingsIcon from "@mui/icons-material/Settings";
import StorageIcon from "@mui/icons-material/Storage";
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid2 as Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  alpha,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useEffect, useState, useCallback } from "react";

interface GuildAnalytics {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  ownerId: string;
  joinedAt: number;
  hasSettings: boolean;
  isCurrentlyPlaying: boolean;
  lastActive?: string;
}

interface AdminStats {
  totalGuilds: number;
  totalMembers: number;
  activeGuilds: number;
  guildsWithSettings: number;
  botStatus: {
    online?: boolean;
    username?: string;
    startedAt?: string;
    guildCount?: number;
  } | null;
}

interface AdminData {
  guilds: GuildAnalytics[];
  stats: AdminStats;
}

function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}) {
  return (
    <Card
      sx={{
        background: `linear-gradient(135deg, ${alpha(color, 0.15)} 0%, ${alpha(color, 0.05)} 100%)`,
        border: `1px solid ${alpha(color, 0.3)}`,
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              background: alpha(color, 0.2),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: color,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              {typeof value === "number" ? value.toLocaleString() : value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function getGuildIconUrl(guildId: string, icon: string | null, size = 64): string {
  if (!icon) return "";
  const format = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${format}?size=${size}`;
}

function formatDate(dateString: string | number): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/guilds");
      
      if (response.status === 403) {
        setError("Access denied. You must be the bot owner to view this page.");
        return;
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch admin data");
      }
      
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter guilds by search
  const filteredGuilds = data?.guilds.filter(
    (guild) =>
      guild.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guild.id.includes(searchQuery)
  ) || [];

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "50vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <Alert severity="error" icon={<AdminPanelSettingsIcon />}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!data) {
    return null;
  }

  const { stats } = data;
  const uptimeMs = stats.botStatus?.startedAt 
    ? Date.now() - new Date(stats.botStatus.startedAt).getTime()
    : 0;
  const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
  const uptimeDays = Math.floor(uptimeHours / 24);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AdminPanelSettingsIcon sx={{ fontSize: 32 }} />
            Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Bot owner analytics and server management
          </Typography>
        </Box>
        <Tooltip title="Refresh data">
          <IconButton onClick={fetchData} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Servers"
            value={stats.totalGuilds}
            icon={<StorageIcon />}
            color="#5865F2"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Total Members"
            value={stats.totalMembers}
            icon={<GroupsIcon />}
            color="#57F287"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Currently Playing"
            value={stats.activeGuilds}
            icon={<PlayCircleIcon />}
            color="#FEE75C"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Configured Servers"
            value={stats.guildsWithSettings}
            icon={<SettingsIcon />}
            color="#EB459E"
          />
        </Grid>
      </Grid>

      {/* Bot Status */}
      {stats.botStatus && (
        <Paper sx={{ p: 3, mb: 4, background: alpha("#5865F2", 0.1), border: "1px solid", borderColor: alpha("#5865F2", 0.3) }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: stats.botStatus.online ? "#57F287" : "#ED4245",
                boxShadow: stats.botStatus.online ? "0 0 10px #57F287" : "0 0 10px #ED4245",
              }}
            />
            <Typography variant="h6" fontWeight={600}>
              {stats.botStatus.username || "Music Bot"}
            </Typography>
            <Chip
              label={stats.botStatus.online ? "Online" : "Offline"}
              color={stats.botStatus.online ? "success" : "error"}
              size="small"
            />
            {uptimeDays > 0 && (
              <Typography variant="body2" color="text.secondary">
                Uptime: {uptimeDays}d {uptimeHours % 24}h
              </Typography>
            )}
          </Box>
        </Paper>
      )}

      {/* Server List */}
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
          <Typography variant="h6" fontWeight={600}>
            <StorageIcon sx={{ mr: 1, verticalAlign: "middle" }} />
            All Servers ({filteredGuilds.length})
          </Typography>
          <TextField
            size="small"
            placeholder="Search servers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ width: 250 }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Server</TableCell>
                <TableCell align="right">Members</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Settings</TableCell>
                <TableCell>Joined</TableCell>
                <TableCell>Last Active</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredGuilds.map((guild) => (
                <TableRow
                  key={guild.id}
                  sx={{
                    "&:hover": { backgroundColor: alpha("#fff", 0.02) },
                    backgroundColor: guild.isCurrentlyPlaying ? alpha("#57F287", 0.05) : "transparent",
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Avatar
                        src={getGuildIconUrl(guild.id, guild.icon)}
                        sx={{ width: 40, height: 40 }}
                      >
                        {guild.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography fontWeight={500}>{guild.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {guild.id}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={500}>
                      {guild.memberCount.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {guild.isCurrentlyPlaying ? (
                      <Chip
                        icon={<MusicNoteIcon />}
                        label="Playing"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip label="Idle" variant="outlined" size="small" />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {guild.hasSettings ? (
                      <Chip
                        icon={<SettingsIcon />}
                        label="Configured"
                        color="primary"
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Chip label="Default" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(guild.joinedAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {guild.lastActive ? formatRelativeTime(guild.lastActive) : "Never"}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View server settings">
                      <IconButton
                        size="small"
                        href={`/servers/${guild.id}/settings`}
                        target="_blank"
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {filteredGuilds.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      {searchQuery ? "No servers match your search" : "No servers found"}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
