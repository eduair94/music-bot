"use client";

import { getBotInviteUrl, getGuildIconUrl, getGuildInitials } from "@/lib/discord";
import { GuildWithBot } from "@/types/discord";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid2 as Grid,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";

interface ServerGridProps {
  guilds: GuildWithBot[];
  showSettings?: boolean;
  showInvite?: boolean;
  botClientId: string;
}

export function ServerGrid({ guilds, showSettings, showInvite, botClientId }: ServerGridProps) {
  return (
    <Grid container spacing={3}>
      {guilds.map((guild) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={guild.id}>
          <Card
            sx={{
              background: "rgba(22, 33, 62, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              transition: "box-shadow 0.2s",
              "&:hover": {
                boxShadow: "0 8px 32px rgba(88, 101, 242, 0.2)",
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Avatar
                    src={getGuildIconUrl(guild) || undefined}
                    alt={guild.name}
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: "primary.main",
                      fontSize: "1.25rem",
                      fontWeight: 600,
                    }}
                  >
                    {getGuildInitials(guild.name)}
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      variant="h6"
                      fontWeight={600}
                      noWrap
                      title={guild.name}
                    >
                      {guild.name}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {guild.botInGuild ? (
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                          label="Bot Active"
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ height: 24 }}
                        />
                      ) : (
                        <Chip
                          label="Bot Not Added"
                          size="small"
                          variant="outlined"
                          sx={{ height: 24, borderColor: "warning.main", color: "warning.main" }}
                        />
                      )}
                    </Stack>
                  </Box>
                </Stack>

                {showSettings && guild.botInGuild && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      component={Link}
                      href={`/servers/${guild.id}/player`}
                      variant="contained"
                      startIcon={<PlayCircleIcon />}
                      fullWidth
                      color="secondary"
                    >
                      Player
                    </Button>
                    <Button
                      component={Link}
                      href={`/servers/${guild.id}/settings`}
                      variant="outlined"
                      startIcon={<SettingsIcon />}
                      fullWidth
                    >
                      Settings
                    </Button>
                  </Stack>
                )}

                {showInvite && !guild.botInGuild && (
                  <Button
                    href={getBotInviteUrl(botClientId, guild.id)}
                    target="_blank"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    fullWidth
                    sx={{
                      borderColor: "primary.main",
                      "&:hover": {
                        bgcolor: "rgba(88, 101, 242, 0.1)",
                      },
                    }}
                  >
                    Add Bot
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
