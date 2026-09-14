/**
 * MUI + Auth providers for the authenticated app surfaces.
 * Kept out of the root layout so the Tailwind-only marketing pages
 * do not ship Emotion, MUI, or the session client bundle.
 */

import { SessionProvider } from "@/components/auth/SessionProvider";
import darkTheme from "@/theme/theme";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppRouterCacheProvider>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </AppRouterCacheProvider>
    </SessionProvider>
  );
}
