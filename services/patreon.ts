import crypto from "crypto";
import { IPatreonUser, PatreonUser } from "../models/PatreonUser";
import { config } from "../utils/config";
import { DatabaseService } from "./database";

/**
 * Patreon API v2 Response Types
 */
interface PatreonMember {
  id: string;
  attributes: {
    full_name: string;
    patron_status: string | null;
    currently_entitled_amount_cents: number;
    lifetime_support_cents: number;
    last_charge_date: string | null;
    last_charge_status: string | null;
    email?: string;
  };
  relationships: {
    user: { data: { id: string } };
    currently_entitled_tiers: { data: Array<{ id: string; type: string }> };
  };
}

interface PatreonUser {
  id: string;
  attributes: {
    full_name: string;
    email?: string;
    social_connections?: {
      discord?: { user_id: string } | null;
    };
  };
}

interface PatreonTier {
  id: string;
  attributes: {
    title: string;
    amount_cents: number;
  };
}

interface PatreonApiResponse {
  data: PatreonMember[] | PatreonMember;
  included?: Array<PatreonUser | PatreonTier>;
  meta?: { pagination?: { cursors?: { next?: string }; total?: number } };
}

/**
 * PatreonService - Handles Patreon API integration
 */
export class PatreonService {
  private static instance: PatreonService;
  private baseUrl = "https://www.patreon.com/api/oauth2/v2";
  private cache: Map<string, { data: IPatreonUser; expires: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): PatreonService {
    if (!this.instance) {
      this.instance = new PatreonService();
    }
    return this.instance;
  }

  /**
   * Check if Patreon integration is configured
   */
  public isConfigured(): boolean {
    return !!(
      config.PATREON_CREATOR_ACCESS_TOKEN &&
      config.PATREON_CAMPAIGN_ID
    );
  }

  /**
   * Make an authenticated API request to Patreon
   */
  private async apiRequest(endpoint: string, accessToken?: string): Promise<PatreonApiResponse | null> {
    const token = accessToken || config.PATREON_CREATOR_ACCESS_TOKEN;
    
    if (!token) {
      console.error("[Patreon] No access token available");
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "MusicBot-Patreon-Integration",
        },
      });

      if (!response.ok) {
        console.error(`[Patreon] API error: ${response.status} ${response.statusText}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error("[Patreon] API request failed:", error);
      return null;
    }
  }

  /**
   * Get all campaign members with their Discord connections
   */
  public async syncAllPatrons(): Promise<number> {
    if (!this.isConfigured()) {
      console.log("[Patreon] Not configured, skipping sync");
      return 0;
    }

    if (!DatabaseService.getInstance().isConnected()) {
      console.log("[Patreon] Database not connected, skipping sync");
      return 0;
    }

    console.log("[Patreon] Starting patron sync...");
    let syncedCount = 0;
    let cursor: string | null = null;

    do {
      const endpoint = `/campaigns/${config.PATREON_CAMPAIGN_ID}/members` +
        `?include=user,currently_entitled_tiers` +
        `&fields[member]=full_name,patron_status,currently_entitled_amount_cents,lifetime_support_cents,last_charge_date,last_charge_status,email` +
        `&fields[user]=full_name,email,social_connections` +
        `&fields[tier]=title,amount_cents` +
        `&page[count]=100` +
        (cursor ? `&page[cursor]=${cursor}` : "");

      const response = await this.apiRequest(endpoint);
      if (!response) break;

      const members = Array.isArray(response.data) ? response.data : [response.data];
      const included = response.included || [];

      for (const member of members) {
        const user = included.find(
          (i): i is PatreonUser => 
            i.id === member.relationships.user.data.id && 
            (i as any).attributes?.social_connections !== undefined
        );

        const discordId = user?.attributes?.social_connections?.discord?.user_id;
        
        if (!discordId) continue; // Skip patrons without Discord linked

        const tierId = member.relationships.currently_entitled_tiers?.data?.[0]?.id;
        const tier = included.find(
          (i): i is PatreonTier => i.id === tierId && (i as any).attributes?.title !== undefined
        );

        await this.updatePatronData({
          discordId,
          patreonId: member.relationships.user.data.id,
          fullName: member.attributes.full_name,
          email: member.attributes.email,
          patronStatus: (member.attributes.patron_status as any) || "not_patron",
          pledgeAmountCents: member.attributes.currently_entitled_amount_cents || 0,
          lifetimeSupportCents: member.attributes.lifetime_support_cents || 0,
          lastChargeDate: member.attributes.last_charge_date 
            ? new Date(member.attributes.last_charge_date) 
            : undefined,
          lastChargeStatus: member.attributes.last_charge_status || undefined,
          tierId,
          tierTitle: tier?.attributes?.title,
        });

        syncedCount++;
      }

      cursor = response.meta?.pagination?.cursors?.next || null;
    } while (cursor);

    console.log(`[Patreon] Synced ${syncedCount} patrons`);
    return syncedCount;
  }

  /**
   * Sync a single patron by their Discord ID
   * Searches through all campaign members to find the one with matching Discord
   */
  public async syncSinglePatron(discordId: string): Promise<{
    found: boolean;
    message: string;
    status?: string;
    tierTitle?: string;
  }> {
    if (!this.isConfigured()) {
      return { found: false, message: "Patreon integration not configured" };
    }

    console.log(`[Patreon] Syncing patron for Discord ID: ${discordId}`);
    let cursor: string | null = null;

    do {
      const endpoint = `/campaigns/${config.PATREON_CAMPAIGN_ID}/members` +
        `?include=user,currently_entitled_tiers` +
        `&fields[member]=full_name,patron_status,currently_entitled_amount_cents,lifetime_support_cents,last_charge_date,last_charge_status,email` +
        `&fields[user]=full_name,email,social_connections` +
        `&fields[tier]=title,amount_cents` +
        `&page[count]=100` +
        (cursor ? `&page[cursor]=${cursor}` : "");

      const response = await this.apiRequest(endpoint);
      if (!response) break;

      const members = Array.isArray(response.data) ? response.data : [response.data];
      const included = response.included || [];

      for (const member of members) {
        const user = included.find(
          (i): i is PatreonUser => 
            i.id === member.relationships.user.data.id && 
            (i as any).attributes?.social_connections !== undefined
        );

        const memberDiscordId = user?.attributes?.social_connections?.discord?.user_id;
        
        if (memberDiscordId === discordId) {
          // Found the user!
          const tierId = member.relationships.currently_entitled_tiers?.data?.[0]?.id;
          const tier = included.find(
            (i): i is PatreonTier => i.id === tierId && (i as any).attributes?.title !== undefined
          );

          await this.updatePatronData({
            discordId,
            patreonId: member.relationships.user.data.id,
            fullName: member.attributes.full_name,
            email: member.attributes.email,
            patronStatus: (member.attributes.patron_status as any) || "not_patron",
            pledgeAmountCents: member.attributes.currently_entitled_amount_cents || 0,
            lifetimeSupportCents: member.attributes.lifetime_support_cents || 0,
            lastChargeDate: member.attributes.last_charge_date 
              ? new Date(member.attributes.last_charge_date) 
              : undefined,
            lastChargeStatus: member.attributes.last_charge_status || undefined,
            tierId,
            tierTitle: tier?.attributes?.title,
          });

          console.log(`[Patreon] Found and synced patron: ${member.attributes.full_name}`);
          return {
            found: true,
            message: `Successfully synced your Patreon data!`,
            status: member.attributes.patron_status || undefined,
            tierTitle: tier?.attributes?.title,
          };
        }
      }

      cursor = response.meta?.pagination?.cursors?.next || null;
    } while (cursor);

    console.log(`[Patreon] No patron found for Discord ID: ${discordId}`);
    return { found: false, message: "No Patreon account found linked to your Discord" };
  }

  /**
   * Update patron data in the database
   */
  private async updatePatronData(data: {
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
  }): Promise<IPatreonUser | null> {
    try {
      // Determine premium status
      const isActivePatron = data.patronStatus === "active_patron";
      const isFounder = isActivePatron && data.tierId === config.PATREON_FOUNDER_TIER_ID;
      const isPremium = isActivePatron;

      const patron = await PatreonUser.findOneAndUpdate(
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
            isFounder,
          },
        },
        { upsert: true, new: true }
      );

      // Clear cache
      this.cache.delete(data.discordId);

      return patron;
    } catch (error) {
      console.error("[Patreon] Error updating patron data:", error);
      return null;
    }
  }

  /**
   * Check if a Discord user has premium status
   */
  public async isPremiumUser(discordId: string): Promise<boolean> {
    const patron = await this.getPatronByDiscordId(discordId);
    return patron?.isPremium || false;
  }

  /**
   * Check if a Discord user is a Founder tier patron
   */
  public async isFounderUser(discordId: string): Promise<boolean> {
    const patron = await this.getPatronByDiscordId(discordId);
    return patron?.isFounder || false;
  }

  /**
   * Get patron data by Discord ID
   */
  public async getPatronByDiscordId(discordId: string): Promise<IPatreonUser | null> {
    // Check cache first
    const cached = this.cache.get(discordId);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    if (!DatabaseService.getInstance().isConnected()) {
      return null;
    }

    try {
      const patron = await PatreonUser.findOne({ discordId });
      
      if (patron) {
        this.cache.set(discordId, {
          data: patron,
          expires: Date.now() + this.cacheTimeout,
        });
      }

      return patron;
    } catch (error) {
      console.error("[Patreon] Error fetching patron:", error);
      return null;
    }
  }

  /**
   * Verify webhook signature
   */
  public verifyWebhookSignature(body: string, signature: string): boolean {
    if (!config.PATREON_WEBHOOK_SECRET) {
      console.warn("[Patreon] Webhook secret not configured");
      return false;
    }

    const expectedSignature = crypto
      .createHmac("md5", config.PATREON_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    return signature === expectedSignature;
  }

  /**
   * Handle webhook event from Patreon
   */
  public async handleWebhook(
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
        await this.updatePatronData({
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
        await this.updatePatronData({
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

  /**
   * Get premium features for a user
   */
  public async getPremiumFeatures(discordId: string): Promise<{
    isPremium: boolean;
    isFounder: boolean;
    tier: string | null;
    features: string[];
  }> {
    const patron = await this.getPatronByDiscordId(discordId);

    if (!patron || !patron.isPremium) {
      return {
        isPremium: false,
        isFounder: false,
        tier: null,
        features: [],
      };
    }

    // Founder / Beta Tester tier features
    const founderFeatures = [
      "audio_filters",        // Audio filters (bass boost, nightcore, etc.)
      "stay_24_7",           // 24/7 mode - bot stays in channel
      "max_quality",         // Maximum audio quality
      "priority_queue",      // Priority in queue
      "unlimited_playlists", // Unlimited saved playlists
      "longer_songs",        // No song duration limit
      "vote_features",       // Vote on new features
      "founder_role",        // Exclusive Founder role
      "direct_support",      // Direct support channel access
    ];

    return {
      isPremium: patron.isPremium,
      isFounder: patron.isFounder,
      tier: patron.tierTitle || null,
      features: patron.isFounder ? founderFeatures : founderFeatures.slice(0, 5),
    };
  }

  /**
   * Clear the patron cache
   */
  public clearCache(discordId?: string): void {
    if (discordId) {
      this.cache.delete(discordId);
    } else {
      this.cache.clear();
    }
  }
}

// Export singleton getter
export function usePatreon(): PatreonService {
  return PatreonService.getInstance();
}
