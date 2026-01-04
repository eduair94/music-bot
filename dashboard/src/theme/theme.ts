"use client";

import { createTheme, alpha } from "@mui/material/styles";

// Discord-inspired color palette
const discordColors = {
  primary: "#5865F2",      // Discord blurple
  secondary: "#F8AA2A",    // Bot's brand color
  success: "#3BA55C",      // Discord green
  error: "#ED4245",        // Discord red
  warning: "#FAA61A",      // Discord yellow
  background: {
    dark: "#1a1a2e",
    paper: "#16213e",
    elevated: "#1f3460",
  },
  text: {
    primary: "#ffffff",
    secondary: "#b9bbbe",
    muted: "#72767d",
  },
};

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: discordColors.primary,
      light: alpha(discordColors.primary, 0.8),
      dark: "#4752c4",
    },
    secondary: {
      main: discordColors.secondary,
    },
    success: {
      main: discordColors.success,
    },
    error: {
      main: discordColors.error,
    },
    warning: {
      main: discordColors.warning,
    },
    background: {
      default: discordColors.background.dark,
      paper: discordColors.background.paper,
    },
    text: {
      primary: discordColors.text.primary,
      secondary: discordColors.text.secondary,
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 700,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
        },
        containedPrimary: {
          "&:hover": {
            backgroundColor: "#4752c4",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: discordColors.background.paper,
          borderRadius: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: discordColors.background.paper,
          borderRight: `1px solid ${alpha("#ffffff", 0.1)}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: discordColors.background.paper,
          backgroundImage: "none",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&.Mui-selected": {
            backgroundColor: alpha(discordColors.primary, 0.2),
            "&:hover": {
              backgroundColor: alpha(discordColors.primary, 0.3),
            },
          },
          "&:hover": {
            backgroundColor: alpha("#ffffff", 0.05),
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: alpha("#000000", 0.2),
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: alpha("#000000", 0.2),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          "& .MuiSwitch-switchBase.Mui-checked": {
            color: discordColors.primary,
            "&:hover": {
              backgroundColor: alpha(discordColors.primary, 0.1),
            },
          },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
            backgroundColor: discordColors.primary,
          },
        },
      },
    },
  },
});

export default darkTheme;
