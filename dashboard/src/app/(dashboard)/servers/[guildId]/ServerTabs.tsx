"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Box, Tabs, Tab, Paper, useTheme, useMediaQuery } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import QueueMusicIcon from "@mui/icons-material/QueueMusic";
import HomeIcon from "@mui/icons-material/Home";

interface ServerTabsProps {
  guildId: string;
}

export function ServerTabs({ guildId }: ServerTabsProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const tabs = [
    {
      label: "Settings",
      href: `/servers/${guildId}`,
      icon: <SettingsIcon />,
      match: (path: string) => path === `/servers/${guildId}` || path.startsWith(`/servers/${guildId}/settings`),
    },
    {
      label: "Player",
      href: `/servers/${guildId}/player`,
      icon: <PlayCircleIcon />,
      match: (path: string) => path.startsWith(`/servers/${guildId}/player`),
    },
  ];

  const currentTab = tabs.findIndex((tab) => tab.match(pathname));

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 3,
        borderRadius: 2,
        background: theme.palette.mode === "dark" 
          ? "rgba(255, 255, 255, 0.05)" 
          : "rgba(0, 0, 0, 0.02)",
      }}
    >
      <Tabs
        value={currentTab === -1 ? 0 : currentTab}
        variant={isMobile ? "fullWidth" : "standard"}
        sx={{
          minHeight: 48,
          "& .MuiTab-root": {
            minHeight: 48,
            textTransform: "none",
            fontWeight: 500,
          },
        }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.href}
            component={Link}
            href={tab.href}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
            sx={{
              gap: 1,
            }}
          />
        ))}
      </Tabs>
    </Paper>
  );
}
