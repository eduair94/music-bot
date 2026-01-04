import { ReactNode } from "react";
import { Box, Tabs, Tab, Paper } from "@mui/material";
import Link from "next/link";
import { ServerTabs } from "./ServerTabs";

interface ServerLayoutProps {
  children: ReactNode;
  params: Promise<{ guildId: string }>;
}

export default async function ServerLayout({
  children,
  params,
}: ServerLayoutProps) {
  const { guildId } = await params;

  return (
    <Box>
      <ServerTabs guildId={guildId} />
      {children}
    </Box>
  );
}
