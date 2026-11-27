/**
 * Sync the bot's public Discord application profile (what people see on the
 * bot's profile card and in "Add App"):
 *  - description and tags;
 *  - install settings: server installs get the `bot` scope with the
 *    permissions the bot needs (before 2026-11 "Add App" installed only
 *    `applications.commands` with no bot user, so music could not play);
 *    user installs keep `applications.commands` (/lyrics, /help, /vote, /invite).
 *
 * Usage (token stays in the environment, never printed):
 *   TOKEN=... npx ts-node --transpile-only scripts/syncAppProfile.ts [--apply]
 * Without --apply it only shows the difference.
 */
import { INVITE_PERMISSIONS } from "../shared/links";

const DESCRIPTION = [
  "Hi-fi music for your server. /play from YouTube, Spotify, SoundCloud, Apple Music or Deezer with live search as you type, " +
    "a button player, autoplay radio, lyrics, effects (bass boost, nightcore, 8D), saved playlists and 24/7 mode. " +
    "Speaks 28 languages.",
  "",
  "Support: discord.gg/KwKwtasGZE",
  "Website: music-bot.checkleaked.com"
].join("\n");

const TAGS = ["music", "24/7", "spotify", "lyrics", "playlists"];

const INTEGRATION_TYPES_CONFIG = {
  "0": { oauth2_install_params: { scopes: ["applications.commands", "bot"], permissions: INVITE_PERMISSIONS } },
  "1": { oauth2_install_params: { scopes: ["applications.commands"], permissions: "0" } }
};

async function main() {
  const token = process.env.TOKEN;
  if (!token) throw new Error("TOKEN is not set");
  if (DESCRIPTION.length > 400) throw new Error(`description is ${DESCRIPTION.length} chars (max 400)`);
  if (TAGS.length > 5 || TAGS.some((t) => t.length > 20)) throw new Error("tags: max 5, 20 chars each");

  const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json" };
  const current = await (await fetch("https://discord.com/api/v10/applications/@me", { headers })).json();
  if (!current.id) throw new Error(`could not read the application: ${JSON.stringify(current).slice(0, 200)}`);

  const desired = { description: DESCRIPTION, tags: TAGS, integration_types_config: INTEGRATION_TYPES_CONFIG };
  console.log(`application: ${current.name} (${current.id})`);
  for (const [key, value] of Object.entries(desired)) {
    const before = JSON.stringify(current[key]);
    const after = JSON.stringify(value);
    console.log(`${before === after ? "=" : "~"} ${key}${before === after ? "" : `\n    before: ${before}\n    after:  ${after}`}`);
  }

  if (!process.argv.includes("--apply")) {
    console.log("\n(dry run; pass --apply to save)");
    return;
  }
  const res = await fetch("https://discord.com/api/v10/applications/@me", { method: "PATCH", headers, body: JSON.stringify(desired) });
  const body = await res.json();
  if (!res.ok) throw new Error(`PATCH failed ${res.status}: ${JSON.stringify(body).slice(0, 500)}`);
  console.log(`\n✅ saved (install params: ${JSON.stringify(body.integration_types_config?.["0"])})`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
