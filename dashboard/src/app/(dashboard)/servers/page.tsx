import { auth } from "@/auth";
import { fetchUserGuilds, filterManageableGuilds, enhanceGuildsWithBotInfo } from "@/lib/discord";
import {
  Box,
  Typography,
  Alert,
  Tabs,
  Tab,
} from "@mui/material";
import { ServerGrid } from "@/components/dashboard/ServerGrid";
import { GuildWithBot } from "@/types/discord";

export default async function ServersPage() {
  const session = await auth();
  
  if (!session?.accessToken) {
    return (
      <Box>
        <Alert severity="error">
          Unable to fetch your servers. Please try logging in again.
        </Alert>
      </Box>
    );
  }

  let guilds: GuildWithBot[] = [];
  let error: string | null = null;

  try {
    const allGuilds = await fetchUserGuilds(session.accessToken);
    const manageableGuilds = filterManageableGuilds(allGuilds);
    guilds = await enhanceGuildsWithBotInfo(manageableGuilds);
  } catch (e: any) {
    error = e.message;
  }

  const guildsWithBot = guilds.filter((g) => g.botInGuild);
  const guildsWithoutBot = guilds.filter((g) => !g.botInGuild);

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          My Servers
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Select a server to configure the music bot settings.
        </Typography>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : guilds.length === 0 ? (
        <Alert severity="info">
          You don&apos;t have permission to manage any servers. You need the &quot;Manage Server&quot; permission.
        </Alert>
      ) : (
        <Box>
          {guildsWithBot.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Configured Servers ({guildsWithBot.length})
              </Typography>
              <ServerGrid guilds={guildsWithBot} showSettings />
            </Box>
          )}

          {guildsWithoutBot.length > 0 && (
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Available Servers ({guildsWithoutBot.length})
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add the bot to these servers to start using it.
              </Typography>
              <ServerGrid guilds={guildsWithoutBot} showInvite />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
