"use client";

import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import DashboardIcon from "@mui/icons-material/Dashboard";
import HelpIcon from "@mui/icons-material/Help";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import PersonIcon from "@mui/icons-material/Person";
import QueueMusicIcon from "@mui/icons-material/QueueMusic";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import StarIcon from "@mui/icons-material/Star";
import StorageIcon from "@mui/icons-material/Storage";
import {
    alpha,
    Box,
    Divider,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  width: number;
  isOwner?: boolean;
}

const menuItems = [
  {
    title: "Overview",
    path: "/dashboard",
    icon: <DashboardIcon />,
  },
  {
    title: "My Servers",
    path: "/servers",
    icon: <StorageIcon />,
  },
  {
    title: "Collections",
    path: "/collections",
    icon: <QueueMusicIcon />,
  },
  {
    title: "My Bots",
    path: "/my-bots",
    icon: <SmartToyIcon />,
  },
  {
    title: "Profile",
    path: "/profile",
    icon: <PersonIcon />,
  },
  {
    title: "Premium",
    path: "/premium",
    icon: <StarIcon />,
  },
];

const bottomMenuItems = [
  {
    title: "Help & Support",
    path: "/help",
    icon: <HelpIcon />,
  },
];

const adminMenuItem = {
  title: "Admin",
  path: "/admin",
  icon: <AdminPanelSettingsIcon />,
};

export function DashboardSidebar({ width, isOwner }: SidebarProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const drawerContent = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Logo Section */}
      <Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #5865F2 0%, #F8AA2A 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MusicNoteIcon sx={{ color: "white", fontSize: 24 }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Music Bot
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Dashboard
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: alpha("#ffffff", 0.1) }} />

      {/* Main Navigation */}
      <Box sx={{ flexGrow: 1, p: 2 }}>
        <Typography
          variant="overline"
          sx={{ px: 2, color: "text.secondary", fontWeight: 600 }}
        >
          Main Menu
        </Typography>
        <List sx={{ mt: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.path}
                selected={pathname === item.path}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon
                  sx={{
                    color: pathname === item.path ? "primary.main" : "text.secondary",
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  primaryTypographyProps={{
                    fontWeight: pathname === item.path ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          
          {/* Admin Menu Item - Only for bot owner */}
          {isOwner && (
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={adminMenuItem.path}
                selected={pathname === adminMenuItem.path}
                sx={{
                  borderRadius: 2,
                  background: pathname === adminMenuItem.path
                    ? alpha("#EB459E", 0.15)
                    : "transparent",
                  "&:hover": {
                    background: alpha("#EB459E", 0.1),
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: pathname === adminMenuItem.path ? "#EB459E" : "text.secondary",
                    minWidth: 40,
                  }}
                >
                  {adminMenuItem.icon}
                </ListItemIcon>
                <ListItemText
                  primary={adminMenuItem.title}
                  primaryTypographyProps={{
                    fontWeight: pathname === adminMenuItem.path ? 600 : 400,
                    color: pathname === adminMenuItem.path ? "#EB459E" : undefined,
                  }}
                />
              </ListItemButton>
            </ListItem>
          )}
        </List>
      </Box>

      {/* Bottom Navigation */}
      <Box sx={{ p: 2 }}>
        <Divider sx={{ mb: 2, borderColor: alpha("#ffffff", 0.1) }} />
        <List>
          {bottomMenuItems.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={Link}
                href={item.path}
                selected={pathname === item.path}
                sx={{ borderRadius: 2 }}
              >
                <ListItemIcon
                  sx={{
                    color: pathname === item.path ? "primary.main" : "text.secondary",
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.title} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );

  if (isMobile) {
    return null; // Mobile drawer would be controlled by header
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width,
          boxSizing: "border-box",
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
