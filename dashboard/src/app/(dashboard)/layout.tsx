import { auth } from "@/auth";
import { DashboardHeader } from "@/components/dashboard/Header";
import { DashboardSidebar } from "@/components/dashboard/Sidebar";
import { Box } from "@mui/material";
import { redirect } from "next/navigation";

const DRAWER_WIDTH = 280;
const OWNER_ID = process.env.OWNER_ID || process.env.DISCORD_OWNER_ID;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Check if user is the bot owner
  const isOwner = session.user?.discordId === OWNER_ID;

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <DashboardSidebar width={DRAWER_WIDTH} isOwner={isOwner} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: "100vh",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          overflow: "auto",
        }}
      >
        <DashboardHeader />
        <Box sx={{ p: { xs: 2, sm: 3 } }}>{children}</Box>
      </Box>
    </Box>
  );
}
