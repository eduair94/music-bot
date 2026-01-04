"use client";

import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import {
    AppBar,
    Avatar,
    Box,
    Chip,
    Divider,
    IconButton,
    ListItemIcon,
    Menu,
    MenuItem,
    Toolbar,
    Typography,
} from "@mui/material";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { MobileDrawer } from "./MobileDrawer";

export function DashboardHeader() {
  const { data: session } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSignOut = () => {
    handleClose();
    signOut({ callbackUrl: "/" });
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/* Mobile Menu */}
        <Box sx={{ display: { xs: "flex", md: "none" } }}>
          <MobileDrawer />
        </Box>
        
        {/* Spacer for desktop */}
        <Box sx={{ display: { xs: "none", md: "block" } }} />
        
        {/* Right side actions */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Chip
            label="Free Plan"
            size="small"
            sx={{
              bgcolor: "rgba(88, 101, 242, 0.2)",
              color: "primary.main",
              fontWeight: 600,
              display: { xs: "none", sm: "flex" },
            }}
          />

          <IconButton onClick={handleMenu} sx={{ p: 0 }}>
            <Avatar
              alt={session?.user?.name || "User"}
              src={session?.user?.image || undefined}
              sx={{ width: 40, height: 40 }}
            >
              {session?.user?.name?.[0]?.toUpperCase() || "U"}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 220,
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {session?.user?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {session?.user?.email}
              </Typography>
            </Box>

            <Divider />

            <MenuItem component={Link} href="/profile" onClick={handleClose}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              Profile
            </MenuItem>

            <MenuItem component={Link} href="/settings" onClick={handleClose}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>

            <Divider />

            <MenuItem onClick={handleSignOut} sx={{ color: "error.main" }}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" color="error" />
              </ListItemIcon>
              Sign Out
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
