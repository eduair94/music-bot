/**
 * Every permission Bypass asks for when it is invited, with the reason shown
 * on the website's /install page. `INVITE_PERMISSIONS` in ./links must equal
 * the OR of these flags; tests/unit/invitePermissions.test.ts checks that
 * against discord.js, so adding a flag here without updating the bitfield (or
 * the other way round) fails the build.
 *
 * Shared by the bot and the dashboard (no Node-only imports).
 */

export interface InvitePermission {
  /** discord.js `PermissionFlagsBits` key. */
  key: string;
  /** Name as Discord's authorization screen shows it. */
  name: string;
  /** What Bypass uses it for, in one sentence. */
  why: string;
  scope: "text" | "voice";
}

export const INVITE_PERMISSION_LIST: InvitePermission[] = [
  { key: "ViewChannel", name: "View Channels", why: "See the text and voice channels you use it in.", scope: "text" },
  { key: "SendMessages", name: "Send Messages", why: "Reply to commands and post the player panel.", scope: "text" },
  {
    key: "SendMessagesInThreads",
    name: "Send Messages in Threads",
    why: "Do the same when a command is run inside a thread.",
    scope: "text",
  },
  { key: "EmbedLinks", name: "Embed Links", why: "Show now-playing cards, the queue and lyrics as embeds.", scope: "text" },
  {
    key: "ReadMessageHistory",
    name: "Read Message History",
    why: "Find the player message it posted earlier and update it in place.",
    scope: "text",
  },
  { key: "Connect", name: "Connect", why: "Join your voice channel.", scope: "voice" },
  { key: "Speak", name: "Speak", why: "Play audio in that channel.", scope: "voice" },
  {
    key: "UseVAD",
    name: "Use Voice Activity",
    why: "Play without push-to-talk in channels that enforce it.",
    scope: "voice",
  },
  { key: "RequestToSpeak", name: "Request to Speak", why: "Play music in stage channels.", scope: "voice" },
  {
    key: "SetVoiceChannelStatus",
    name: "Set Voice Channel Status",
    why: "Show the current song as the voice channel status.",
    scope: "voice",
  },
];

/** Powers Bypass never asks for. Listed on /install; the test keeps them out of the bitfield. */
export const NEVER_REQUESTED: { key: string; name: string }[] = [
  { key: "Administrator", name: "Administrator" },
  { key: "ManageGuild", name: "Manage Server" },
  { key: "ManageRoles", name: "Manage Roles" },
  { key: "ManageChannels", name: "Manage Channels" },
  { key: "ManageMessages", name: "Manage Messages" },
  { key: "ManageWebhooks", name: "Manage Webhooks" },
  { key: "KickMembers", name: "Kick Members" },
  { key: "BanMembers", name: "Ban Members" },
  { key: "ModerateMembers", name: "Timeout Members" },
  { key: "MentionEveryone", name: "Mention @everyone" },
];
