import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ guildId: string }>;
}

export default async function ServerPage({ params }: Props) {
  const { guildId } = await params;
  // Redirect to settings by default
  redirect(`/servers/${guildId}/settings`);
}
