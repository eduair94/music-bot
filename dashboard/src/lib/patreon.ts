/**
 * Patreon Webhook Service for Dashboard
 * 
 * This service handles Patreon webhook events directly in the Next.js API routes,
 * replacing the separate Express webhook server.
 */

import crypto from "crypto";
import { PatreonUserModel } from "./models/PatreonUser";
import { connectToDatabase } from "./mongodb";

// Environment variables
const PATREON_WEBHOOK_SECRET = process.env.PATREON_WEBHOOK_SECRET;
const PATREON_CREATOR_ACCESS_TOKEN = process.env.PATREON_CREATOR_ACCESS_TOKEN;

/**
 * Verify Patreon webhook signature
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!PATREON_WEBHOOK_SECRET) {
    console.warn("[Patreon] Webhook secret not configured");
    return false;
  }

  const expectedSignature = crypto
    .createHmac("md5", PATREON_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  return signature === expectedSignature;
}

/**
 * Check if Patreon is configured
 */
export function isPatreonConfigured(): boolean {
  return !!(PATREON_WEBHOOK_SECRET && PATREON_CREATOR_ACCESS_TOKEN);
}

/**
 * Get audio bitrate based on pledge amount
 */
function getAudioBitrate(pledgeAmountCents: number): number {
  if (pledgeAmountCents >= 2500) return 320; // $25+ = 320kbps
  if (pledgeAmountCents >= 1000) return 256; // $10+ = 256kbps
  if (pledgeAmountCents >= 300) return 192;  // $3+ = 192kbps
  return 128; // Free = 128kbps
}

/**
 * Update patron data in the database
 */
async function updatePatronData(data: {
  discordId: string;
  patreonId: string;
  fullName?: string;
  email?: string;
  patronStatus: string;
  pledgeAmountCents: number;
  lifetimeSupportCents: number;
  lastChargeDate?: Date;
  lastChargeStatus?: string;
  tierId?: string;
  tierTitle?: string;
}): Promise<void> {
  // Ensure database connection
  await connectToDatabase();

  const isPremium = data.patronStatus === "active_patron" && data.pledgeAmountCents > 0;
  const audioBitrate = getAudioBitrate(data.pledgeAmountCents);

  await PatreonUserModel.findOneAndUpdate(
    { discordId: data.discordId },
    {
      $set: {
        patreonId: data.patreonId,
        fullName: data.fullName,
        email: data.email,
        patronStatus: data.patronStatus,
        pledgeAmountCents: data.pledgeAmountCents,
        lifetimeSupportCents: data.lifetimeSupportCents,
        lastChargeDate: data.lastChargeDate,
        lastChargeStatus: data.lastChargeStatus,
        tierId: data.tierId,
        tierTitle: data.tierTitle,
        isPremium,
        audioBitrate,
      },
    },
    { upsert: true, new: true }
  );

  console.log(`[Patreon] Updated patron ${data.discordId}: premium=${isPremium}, bitrate=${audioBitrate}`);
}

/**
 * Handle webhook event from Patreon
 */
export async function handleWebhook(
  event: string,
  body: any
): Promise<{ success: boolean; message: string }> {
  console.log(`[Patreon] Received webhook: ${event}`);

  const member = body.data;
  const included = body.included || [];

  // Find the user with Discord connection
  const user = included.find(
    (i: any) => i.type === "user" && i.attributes?.social_connections?.discord
  );

  const discordId = user?.attributes?.social_connections?.discord?.user_id;

  if (!discordId) {
    return { success: true, message: "No Discord connection found, skipping" };
  }

  const tierId = member.relationships?.currently_entitled_tiers?.data?.[0]?.id;
  const tier = included.find((i: any) => i.type === "tier" && i.id === tierId);

  switch (event) {
    case "members:pledge:create":
    case "members:pledge:update":
    case "members:create":
    case "members:update":
      await updatePatronData({
        discordId,
        patreonId: member.relationships?.user?.data?.id || user?.id,
        fullName: member.attributes?.full_name,
        email: member.attributes?.email,
        patronStatus: member.attributes?.patron_status || "active_patron",
        pledgeAmountCents: member.attributes?.currently_entitled_amount_cents || 0,
        lifetimeSupportCents: member.attributes?.lifetime_support_cents || 0,
        lastChargeDate: member.attributes?.last_charge_date
          ? new Date(member.attributes.last_charge_date)
          : undefined,
        lastChargeStatus: member.attributes?.last_charge_status,
        tierId,
        tierTitle: tier?.attributes?.title,
      });
      return { success: true, message: `Patron ${discordId} updated` };

    case "members:pledge:delete":
    case "members:delete":
      await updatePatronData({
        discordId,
        patreonId: member.relationships?.user?.data?.id || user?.id,
        patronStatus: "former_patron",
        pledgeAmountCents: 0,
        lifetimeSupportCents: member.attributes?.lifetime_support_cents || 0,
      });
      return { success: true, message: `Patron ${discordId} removed` };

    default:
      return { success: true, message: `Unknown event: ${event}` };
  }
}
