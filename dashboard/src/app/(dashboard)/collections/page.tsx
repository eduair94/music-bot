import { auth } from "@/auth";
import { Box, Typography } from "@mui/material";
import { redirect } from "next/navigation";
import { CollectionsClient } from "./CollectionsClient";

export const dynamic = 'force-dynamic';

export default async function CollectionsPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          My Collections
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Create and manage your personal music collections. Save your favorite playlists and load them into any server.
        </Typography>
      </Box>

      <CollectionsClient />
    </Box>
  );
}
