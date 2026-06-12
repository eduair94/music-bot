"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Button, CircularProgress } from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";

export function LoginButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="contained" disabled size="large" sx={{ px: 4, py: 1.5 }}>
        <CircularProgress size={20} sx={{ mr: 1 }} />
        Loading...
      </Button>
    );
  }

  if (session) {
    return (
      <Button
        variant="outlined"
        color="error"
        onClick={() => signOut()}
        startIcon={<LogoutIcon />}
        size="large"
        sx={{ px: 4, py: 1.5 }}
      >
        Sign Out
      </Button>
    );
  }

  return (
    <Button
      variant="contained"
      onClick={() => signIn("discord")}
      startIcon={<LoginIcon />}
      size="large"
      sx={{
        px: 4,
        py: 1.5,
        bgcolor: "#5865F2",
        color: "#ffffff",
        "&:hover": {
          bgcolor: "#4752c4",
        },
      }}
    >
      Login with Discord
    </Button>
  );
}
