/**
 * Script to retrieve your Patreon Campaign ID
 * Usage: npm run patreon:campaign
 */

import { config } from "../utils/config";

async function getCampaignId() {
  console.log("\nÌæ≠ Fetching Patreon Campaign ID...\n");

  if (!config.PATREON_CREATOR_ACCESS_TOKEN) {
    console.error("‚ùå PATREON_CREATOR_ACCESS_TOKEN is not set in config.json");
    console.log("\nTo get your Creator Access Token:");
    console.log("1. Go to https://www.patreon.com/portal/registration/register-clients");
    console.log("2. Create or select your API client");
    console.log("3. Copy the 'Creator's Access Token'");
    console.log("4. Add it to config.json as PATREON_CREATOR_ACCESS_TOKEN");
    process.exit(1);
  }

  try {
    const response = await fetch("https://www.patreon.com/api/oauth2/v2/campaigns", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.PATREON_CREATOR_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`‚ùå API Error (${response.status}): ${errorText}`);
      console.log("\nMake sure your Creator Access Token is valid and not expired.");
      process.exit(1);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      console.error("‚ùå No campaigns found for this account.");
      console.log("Make sure you have a Patreon creator account with an active campaign.");
      process.exit(1);
    }

    console.log("‚úÖ Campaign(s) found!\n");
    console.log("=".repeat(50));

    for (const campaign of data.data) {
      console.log(`\nÌ≥ã Campaign ID: ${campaign.id}`);
      console.log(`\nAdd this to your config.json:`);
      console.log(`  "PATREON_CAMPAIGN_ID": "${campaign.id}"`);
    }

    console.log("\n" + "=".repeat(50));
    console.log("\n‚ú® Next steps:");
    console.log("1. Copy the Campaign ID above");
    console.log("2. Add it to your config.json");
    console.log("3. Restart the bot");
    console.log("");

  } catch (error: any) {
    console.error(`‚ùå Error: ${error.message}`);
    process.exit(1);
  }
}

getCampaignId();
