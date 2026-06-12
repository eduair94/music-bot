"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  IconButton,
  alpha,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import StorageIcon from "@mui/icons-material/Storage";
import PersonIcon from "@mui/icons-material/Person";
import StarIcon from "@mui/icons-material/Star";
import HelpIcon from "@mui/icons-material/Help";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import BrandMark from "@/components/common/BrandMark";

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
    title: "Profile",
    path: "/profile",
    icon: <PersonIcon />,
  },
  {
    title: "Premium",
    path: "/premium",
    icon: <StarIcon />,
  },
  {
    title: "Help & Support",
    path: "/help",
    icon: <HelpIcon />,
  },
];

export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const handleNavigation = () => {
    setOpen(false);
  };

  return (
    <>
      <IconButton
        color="inherit"
        aria-label="open drawer"
        onClick={toggleDrawer(true)}
        sx={{ display: { md: "none" } }}
      >
        <MenuIcon />
      </IconButton>

      <Drawer
        anchor="left"
        open={open}
        onClose={toggleDrawer(false)}
        sx={{
          display: { md: "none" },
          "& .MuiDrawer-paper": {
            width: 280,
            boxSizing: "border-box",
          },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <Box
            sx={{
              p: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <BrandMark size={36} />
              <Typography variant="h6" fontWeight={700}>
                Bypass
              </Typography>
            </Box>
            <IconButton onClick={toggleDrawer(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider sx={{ borderColor: alpha("#ffffff", 0.1) }} />

          {/* Navigation */}
          <Box sx={{ flexGrow: 1, p: 2 }}>
            <List>
              {menuItems.map((item) => (
                <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    href={item.path}
                    selected={pathname === item.path || pathname.startsWith(`${item.path}/`)}
                    onClick={handleNavigation}
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
            </List>
          </Box>
        </Box>
      </Drawer>
    </>
  );
}
