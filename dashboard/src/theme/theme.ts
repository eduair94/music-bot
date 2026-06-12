"use client";

import { alpha, createTheme } from "@mui/material/styles";

/**
 * Studio-console palette — warm near-black chassis, VU-meter amber signal.
 * Mirrors the CSS custom properties in globals.css.
 */
const console_ = {
  amber: "#f8aa2a",
  amberHot: "#ffc24d",
  amberDeep: "#b86e0a",
  signal: "#5be49b",
  clip: "#ff5a48",
  blurple: "#5865f2",
  coal: "#0c0a09",
  panel: "#151210",
  panelRaised: "#1d1916",
  line: "#2b2520",
  lineBright: "#3d342c",
  cream: "#f4efe9",
  dune: "#a89d90",
  dust: "#6e645a",
};

export const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: console_.amber,
      light: console_.amberHot,
      dark: console_.amberDeep,
      contrastText: console_.coal,
    },
    secondary: {
      main: console_.blurple,
    },
    success: {
      main: console_.signal,
    },
    error: {
      main: console_.clip,
    },
    warning: {
      main: console_.amberHot,
    },
    divider: console_.line,
    background: {
      default: console_.coal,
      paper: console_.panel,
    },
    text: {
      primary: console_.cream,
      secondary: console_.dune,
      disabled: console_.dust,
    },
  },
  typography: {
    fontFamily: "var(--font-instrument), ui-sans-serif, sans-serif",
    h1: { fontFamily: "var(--font-bricolage), Georgia, serif", fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontFamily: "var(--font-bricolage), Georgia, serif", fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontFamily: "var(--font-bricolage), Georgia, serif", fontWeight: 600, letterSpacing: "-0.01em" },
    h4: { fontFamily: "var(--font-bricolage), Georgia, serif", fontWeight: 600, letterSpacing: "-0.01em" },
    h5: { fontFamily: "var(--font-bricolage), Georgia, serif", fontWeight: 600 },
    h6: { fontFamily: "var(--font-bricolage), Georgia, serif", fontWeight: 600 },
    overline: {
      fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
      letterSpacing: "0.18em",
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          boxShadow: "none",
        },
        containedPrimary: {
          color: console_.coal,
          "&:hover": {
            backgroundColor: console_.amberHot,
            boxShadow: "none",
          },
        },
        outlined: {
          borderColor: console_.lineBright,
          "&:hover": {
            borderColor: alpha(console_.amber, 0.6),
            backgroundColor: alpha(console_.amber, 0.06),
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          background: `linear-gradient(180deg, ${console_.panelRaised}, ${console_.panel})`,
          border: `1px solid ${console_.line}`,
          borderRadius: 14,
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
          backgroundColor: console_.panel,
          borderRight: `1px solid ${console_.line}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(console_.coal, 0.92),
          backdropFilter: "blur(8px)",
          backgroundImage: "none",
          borderBottom: `1px solid ${console_.line}`,
          boxShadow: "none",
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          "&.Mui-selected": {
            backgroundColor: alpha(console_.amber, 0.12),
            color: console_.amberHot,
            "&:hover": {
              backgroundColor: alpha(console_.amber, 0.18),
            },
            "& .MuiListItemIcon-root": {
              color: console_.amber,
            },
          },
          "&:hover": {
            backgroundColor: alpha("#ffffff", 0.04),
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            backgroundColor: alpha("#000000", 0.25),
            "& fieldset": {
              borderColor: console_.line,
            },
            "&:hover fieldset": {
              borderColor: console_.lineBright,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: alpha("#000000", 0.25),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 6,
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          "& .MuiSwitch-switchBase.Mui-checked": {
            color: console_.amber,
            "&:hover": {
              backgroundColor: alpha(console_.amber, 0.1),
            },
          },
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
            backgroundColor: console_.amber,
          },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          backgroundColor: console_.panelRaised,
          borderRadius: 99,
        },
        bar: {
          backgroundColor: console_.amber,
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          color: console_.amber,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: console_.panelRaised,
          border: `1px solid ${console_.lineBright}`,
          color: console_.cream,
          fontSize: "0.75rem",
        },
      },
    },
  },
});

export default darkTheme;
