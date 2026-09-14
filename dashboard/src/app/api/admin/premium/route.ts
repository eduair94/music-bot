import { adminJson, requireOwner } from "@/lib/admin-auth";
import { LinkedBotModel } from "@/lib/models/LinkedBot";
import { PatreonUserModel } from "@/lib/models/PatreonUser";
import { PremiumGuild } from "@/lib/models/PremiumGuild";
import { connectToDatabase } from "@/lib/mongodb";
import type { AdminPremium } from "@/types/admin";
import type { ILinkedBot, IPatreonUser } from "../../../../../../shared/types";

export const dynamic = "force-dynamic";

interface PremiumGuildDoc {
  guildId: string;
  guildName?: string;
  discordId: string;
  audioBitrate: number;
  isActive: boolean;
  linkedAt: Date;
  lastUsed?: Date;
}

export async function GET() {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  try {
    await connectToDatabase();
    const [patrons, premiumGuilds, linkedBots] = await Promise.all([
      PatreonUserModel.find({}).sort({ isPremium: -1, lifetimeSupportCents: -1 }).limit(200).lean<IPatreonUser[]>(),
      PremiumGuild.find({}).sort({ isActive: -1, linkedAt: -1 }).limit(200).lean<PremiumGuildDoc[]>(),
      LinkedBotModel.find({}).sort({ status: 1 }).limit(200).lean<ILinkedBot[]>()
    ]);
    const body: AdminPremium = {
      patrons: patrons.map((p) => ({
        discordId: p.discordId,
        fullName: p.fullName,
        tierTitle: p.tierTitle,
        patronStatus: p.patronStatus,
        pledgeUsd: (p.pledgeAmountCents || 0) / 100,
        lifetimeUsd: (p.lifetimeSupportCents || 0) / 100,
        isPremium: p.isPremium,
        isFounder: p.isFounder,
        lastChargeDate: p.lastChargeDate ? new Date(p.lastChargeDate).toISOString() : undefined,
        lastChargeStatus: p.lastChargeStatus
      })),
      premiumGuilds: premiumGuilds.map((g) => ({
        guildId: g.guildId,
        guildName: g.guildName,
        discordId: g.discordId,
        audioBitrate: g.audioBitrate,
        isActive: g.isActive,
        linkedAt: new Date(g.linkedAt).toISOString(),
        lastUsed: g.lastUsed ? new Date(g.lastUsed).toISOString() : undefined
      })),
      linkedBots: linkedBots.map((b) => ({
        botId: b.botId,
        botUsername: b.botUsername,
        ownerId: b.ownerId,
        ownerUsername: b.ownerUsername,
        status: b.status,
        totalGuilds: b.totalGuilds || 0,
        totalSongsPlayed: b.totalSongsPlayed || 0,
        lastError: b.lastError ?? null,
        lastStatusChange: new Date(b.lastStatusChange).toISOString()
      }))
    };
    return adminJson(body);
  } catch (error) {
    console.error("[admin/premium] error:", error);
    return adminJson({ error: "Internal server error" }, 500);
  }
}
