/**
 * Configure the official support server to current Discord best practices.
 * Idempotent: finds things by ID or name, creates what's missing, renames and
 * moves the rest. Every channel gets explicit permission overwrites so the
 * layout doesn't depend on whatever was clicked in the UI before.
 *
 *   TOKEN=... npx ts-node --transpile-only scripts/setupSupportServer.ts [--apply] [--assets]
 *
 * Without --apply it prints the plan. --assets also uploads the server icon and
 * the :bypass: emoji from assets/brand. The bot must be an administrator there.
 *
 * Role model (least privilege):
 *   Administrators  Administrator
 *   Developers      channel/webhook/message management, timeouts, no bans, no Administrator
 *   Moderators      timeouts, kick, ban, message/thread/nickname management, audit log
 *   Support         thread management (lock/close/tag #help posts), pins
 *   everything else cosmetic: no permissions of its own, @everyone governs
 * Bots run on their own managed role. Bypass's managed role holds Administrator
 * (this script, role sync and the live status need it); the hoisted "Bots" role
 * is cosmetic only, so adding a bot to it no longer makes that bot an admin.
 */
import fs from "fs";
import path from "path";
import {
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SeparatorSpacingSize,
  StringSelectMenuBuilder
} from "discord.js";
import { botInviteUrl, PATREON_URL, SITE_URL, SUPPORT_INVITE_URL, TOPGG_VOTE_URL } from "../shared/links";
import { TICKET_TOPICS } from "../shared/tickets";

const GUILD = "1458199268564406487";
const APPLY = process.argv.includes("--apply");
const ASSETS = process.argv.includes("--assets");
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);
const log = (...a: unknown[]) => console.log(APPLY ? "•" : "(plan)", ...a);
const warn = (label: string, e: any) => console.warn(`  ! ${label}: ${e?.rawError ? JSON.stringify(e.rawError).slice(0, 400) : e?.message ?? e}`);

/** The first permanent invite (points at #tickets, kept because bot lists link it). */
const LEGACY_INVITE = "hjJQKp5zDU";
const CARL_BOT = "235148962103951360";
const TICKET_TOOL = "557628352828014614";
const BRAND = path.join(__dirname, "..", "assets", "brand");

// Existing IDs (from scripts/inspectGuild.ts, 2026-11-26)
const ID = {
  catStart: "1458199270006980702",
  welcome: "1458199270006980703",
  rules: "1575653089988313279",
  announcements: "1458199270006980704",
  changelog: "1458199270006980705",
  status: "1458199270006980706",
  votes: "1575653099887132672",
  github: "1458199270006980707",
  catSupport: "1575653079850688583",
  faq: "1575653112813715487",
  help: "1575653114336251945",
  tickets: "1458199270183407751",
  catCommunity: "1458199270183407749",
  general: "1458199270183407750",
  suggestions: "1575653111274672269",
  catTry: "1458199270183407755",
  botCommands: "1458199270183407754",
  musicLounge: "1458199270183407757",
  hangout: "1458199270183407756",
  afk: "1458199270359564424",
  staffVoice: "1458199270359564423",
  catStaff: "1458199270359564425",
  staffNews: "1458199270359564426",
  staffChat: "1458199270359564427",
  staffCommands: "1458199270359564428",
  serverLogs: "1458199270359564429",
  discordUpdates: "1458199270359564430",
  modLogs: "1458199270359564431",
  messageLogs: "1458199270359564432",
  memberLogs: "1458199270556434597",
  catBotLogs: "1458199270556434598",
  guildJoin: "1458199270556434599",
  guildLeave: "1458199270556434600",
  botErrors: "1458199270556434601"
};

const V = PermissionFlagsBits;
const bits = (...p: bigint[]) => p.reduce((a, b) => a | b, 0n).toString();
type Json = Record<string, any>;
type Overwrite = { id: string; type: 0 | 1; allow: string; deny: string };

async function api<T = any>(method: "get" | "post" | "patch" | "put" | "delete", route: `/${string}`, body?: unknown, reason?: string): Promise<T> {
  if (method !== "get" && !APPLY) return undefined as T;
  return (await (rest as any)[method](route, { body, reason: reason ?? "Support server setup" })) as T;
}

/** Rules shown in #rules and in Discord's rules screening. */
const RULES: [string, string][] = [
  ["Be respectful.", "No harassment, hate speech, discrimination or personal attacks."],
  ["Keep it safe for work.", "No NSFW, gore or shock content, including names, avatars and statuses."],
  ["No spam or advertising.", "No self-promotion, server invites or unsolicited DMs to members."],
  ["Use the right channel.", "Help goes in #help, ideas in #suggestions, bot commands in #bot-commands."],
  ["Don't ping or DM staff for support.", "Open a post in #help or a ticket and someone will answer."],
  ["No scams or piracy.", "No malicious links, cracked software, or buying, selling or trading accounts."],
  ["English or Spanish in public channels,", "so moderators can follow the conversation."],
  ["Follow Discord's Terms of Service and Community Guidelines.", "discord.com/terms · discord.com/guidelines"]
];

async function main() {
  const guild = (await rest.get(Routes.guild(GUILD))) as Json;
  let channels: Json[] = (await rest.get(Routes.guildChannels(GUILD))) as Json[];
  const roles: Json[] = (await rest.get(Routes.guildRoles(GUILD))) as Json[];
  const me = (await rest.get(Routes.user("@me"))) as Json;
  const everyone = GUILD;
  const roleByName = (name: string) => roles.find((r) => r.name === name);
  const botRole = (botId: string) => roles.find((r) => r.tags?.bot_id === botId);

  // ================================================================= roles
  const R = {
    admin: roleByName("Administrators")?.id as string | undefined,
    dev: roleByName("Developers")?.id as string | undefined,
    mod: roleByName("Moderators")?.id as string | undefined,
    sup: roleByName("Support")?.id as string | undefined,
    bots: roleByName("Bots")?.id as string | undefined,
    bypass: botRole(me.id)?.id as string | undefined,
    carl: botRole(CARL_BOT)?.id as string | undefined
  };
  const staffIds = [R.admin, R.dev, R.mod, R.sup].filter(Boolean) as string[];

  // Bypass's own role takes over Administrator before "Bots" gives it up.
  if (R.bypass && !(BigInt(botRole(me.id)!.permissions) & V.Administrator)) {
    log("Bypass managed role → Administrator");
    await api("patch", Routes.guildRole(GUILD, R.bypass), { permissions: bits(V.Administrator) });
  }

  const ensureRole = async (name: string, data: Json) => {
    const found = roleByName(name);
    if (found) return found;
    log(`create role ${name}`);
    const created = await api<Json>("post", Routes.guildRoles(GUILD), { name, ...data });
    if (created) roles.push(created);
    return created ?? { id: `<${name}>`, name };
  };
  const patreons = roleByName("Patreons");
  if (patreons) {
    log("rename role Patreons → Founders");
    await api("patch", Routes.guildRole(GUILD, patreons.id), { name: "Founders" });
    patreons.name = "Founders";
  }
  const updatesRole = await ensureRole("📣 Updates", { color: 0x5865f2, mentionable: false, hoist: false, permissions: "0" });
  const statusRole = await ensureRole("📡 Status Alerts", { color: 0xed4245, mentionable: false, hoist: false, permissions: "0" });
  await ensureRole("Server Owners", { color: 0xf8aa2a, mentionable: false, hoist: true, permissions: "0" });

  // @everyone: Discord's "safe baseline" (no @everyone pings, no management,
  // no creating expressions). External apps are allowed in #bot-commands only.
  const everyoneBaseline = bits(
    V.ViewChannel, V.CreateInstantInvite, V.ChangeNickname, V.SendMessages, V.SendMessagesInThreads, V.CreatePublicThreads,
    V.EmbedLinks, V.AttachFiles, V.AddReactions, V.UseExternalEmojis, V.UseExternalStickers, V.ReadMessageHistory,
    V.UseApplicationCommands, V.Connect, V.Speak, V.Stream, V.UseVAD, V.UseEmbeddedActivities, V.UseSoundboard,
    V.UseExternalSounds, V.SendVoiceMessages, V.SendPolls, V.RequestToSpeak
  );
  const ROLE_PERMS: Record<string, string> = {
    Administrators: bits(V.Administrator),
    Developers: bits(
      V.ViewAuditLog, V.ManageChannels, V.ManageWebhooks, V.ManageMessages, V.ManageThreads, V.PinMessages, V.ManageNicknames,
      V.ManageEvents, V.ModerateMembers, V.KickMembers, V.MuteMembers, V.MoveMembers, V.MentionEveryone, V.ManageGuildExpressions, V.BypassSlowmode
    ),
    Moderators: bits(
      V.ViewAuditLog, V.ManageMessages, V.ManageThreads, V.PinMessages, V.ManageNicknames, V.ModerateMembers,
      V.KickMembers, V.BanMembers, V.MuteMembers, V.DeafenMembers, V.MoveMembers, V.BypassSlowmode
    ),
    Support: bits(V.ManageThreads, V.PinMessages, V.BypassSlowmode)
  };
  const COSMETIC = ["Bots", "Founders", "Partners", "Server Owners", "Voter", "Members", "📣 Updates", "📡 Status Alerts"];

  log("@everyone safe permission baseline");
  await api("patch", Routes.guildRole(GUILD, everyone), { permissions: everyoneBaseline });
  for (const r of roles) {
    const target = ROLE_PERMS[r.name] ?? (COSMETIC.includes(r.name) || r.name.startsWith("━") ? "0" : undefined);
    if (target === undefined || r.managed || r.permissions === target) continue;
    log(`role ${r.name}: permissions ${r.permissions} → ${target}`);
    await api("patch", Routes.guildRole(GUILD, r.id), { permissions: target }).catch((e) => warn(`role ${r.name}`, e));
  }
  // Separators read as section labels in the role list.
  const separators = roles.filter((r) => /^━/.test(r.name)).sort((a, b) => b.position - a.position);
  const sepNames = ["━━━ Supporters ━━━", "━━━ Community ━━━", "━━━ Bots & Pings ━━━"];
  for (const [i, r] of separators.slice(0, 3).entries()) {
    if (r.name === sepNames[i]) continue;
    log(`separator → ${sepNames[i]}`);
    await api("patch", Routes.guildRole(GUILD, r.id), { name: sepNames[i] });
  }
  // Third-party bots join the cosmetic Bots group in the member list.
  for (const botId of [CARL_BOT]) {
    if (!R.bots) break;
    const member = (await rest.get(Routes.guildMember(GUILD, botId)).catch(() => null)) as Json | null;
    if (member && !member.roles.includes(R.bots)) {
      log(`add Bots role to ${member.user.username}`);
      await api("put", Routes.guildMemberRole(GUILD, botId, R.bots)).catch((e) => warn("Bots role (move Bypass's role above Bots)", e));
    }
  }

  // ===================================================== permission sets
  const ow = (id: string | undefined, allow: bigint[] = [], deny: bigint[] = []): Overwrite[] =>
    id && !id.startsWith("<") ? [{ id, type: 0, allow: bits(...allow), deny: bits(...deny) }] : [];
  const READ = [V.ViewChannel, V.ReadMessageHistory];
  const POST = [V.SendMessages, V.SendMessagesInThreads, V.EmbedLinks, V.AttachFiles, V.AddReactions, V.UseExternalEmojis];
  const NO_POST = [V.SendMessages, V.SendMessagesInThreads, V.CreatePublicThreads, V.CreatePrivateThreads, V.SendPolls, V.SendVoiceMessages];
  const NO_APPS = [V.UseApplicationCommands, V.UseExternalApps];
  const STAFF_POST = [V.SendMessages, V.SendMessagesInThreads];
  const STAFF_ACCESS = [...READ, ...POST, V.UseApplicationCommands, V.Connect, V.Speak, V.Stream, V.UseVAD];

  /** Read-only info channel: members read (and can join existing reactions); Developers post. */
  const readOnly = (reactions = false): Overwrite[] => [
    ...ow(everyone, reactions ? [...READ, V.AddReactions] : READ, [...NO_POST, ...NO_APPS, ...(reactions ? [] : [V.AddReactions])]),
    ...ow(R.dev, [...POST, V.MentionEveryone, V.UseApplicationCommands])
  ];
  /** Support area: members post, can't run apps; helpers manage posts. */
  const supportArea: Overwrite[] = [
    ...ow(everyone, [...READ, ...POST], [V.CreatePublicThreads, V.CreatePrivateThreads, ...NO_APPS]),
    ...ow(R.sup, [V.ManageMessages, V.ManageThreads, V.UseApplicationCommands]),
    ...ow(R.mod, [V.UseApplicationCommands]),
    ...ow(R.dev, [V.UseApplicationCommands])
  ];
  /** Ticket panel: nobody chats; Bypass opens a private thread per ticket (members write inside it). */
  const ticketPanel: Overwrite[] = [
    ...ow(everyone, [...READ, V.SendMessagesInThreads, V.EmbedLinks, V.AttachFiles], [V.SendMessages, V.CreatePublicThreads, V.CreatePrivateThreads, V.AddReactions, V.SendPolls, ...NO_APPS]),
    ...ow(R.sup, [V.ManageThreads, V.UseApplicationCommands]),
    ...ow(R.mod, [V.ManageThreads, V.UseApplicationCommands]),
    ...ow(R.dev, [...POST, V.UseApplicationCommands])
  ];
  /** Community chat: members talk and open threads; commands live in #bot-commands. */
  const community: Overwrite[] = [
    ...ow(everyone, [...READ, ...POST, V.CreatePublicThreads], [V.CreatePrivateThreads, ...NO_APPS]),
    ...ow(R.sup, [V.UseApplicationCommands]),
    ...ow(R.mod, [V.UseApplicationCommands]),
    ...ow(R.dev, [V.UseApplicationCommands])
  ];
  /** Playground: the only place members run apps, including user-installed ones. */
  const playground: Overwrite[] = [
    ...ow(everyone, [...READ, ...POST, V.UseApplicationCommands, V.UseExternalApps, V.Connect, V.Speak, V.UseVAD, V.Stream], [V.CreatePublicThreads, V.CreatePrivateThreads, V.SendPolls])
  ];
  /** Listening room: members hear Bypass and chat in the voice text, only the bot talks. */
  const listeningRoom: Overwrite[] = [
    ...ow(everyone, [...READ, V.SendMessages, V.EmbedLinks, V.UseApplicationCommands, V.Connect], [V.Speak, V.Stream, V.UseSoundboard, V.UseEmbeddedActivities, V.CreatePublicThreads, V.CreatePrivateThreads]),
    ...ow(R.mod, [V.Speak, V.MuteMembers, V.MoveMembers]),
    ...ow(R.dev, [V.Speak, V.MuteMembers, V.MoveMembers])
  ];
  const afkRoom: Overwrite[] = [
    ...ow(everyone, [V.ViewChannel, V.Connect], [V.Speak, V.Stream, V.SendMessages, V.UseSoundboard, V.UseEmbeddedActivities, ...NO_APPS])
  ];
  /** Staff-only. `post` = which staff roles may write; logs are written by bots only. */
  const staff = (post: ("dev" | "mod" | "sup")[], carl = false): Overwrite[] => [
    ...ow(everyone, [], [V.ViewChannel, V.Connect]),
    ...(["dev", "mod", "sup"] as const).flatMap((k) =>
      post.includes(k) ? ow(R[k], STAFF_ACCESS) : ow(R[k], STAFF_ACCESS.filter((p) => !STAFF_POST.includes(p)), STAFF_POST)
    ),
    ...(carl ? ow(R.carl, [...READ, V.SendMessages, V.EmbedLinks, V.AttachFiles]) : [])
  ];
  const STAFF_ALL = staff(["dev", "mod", "sup"]);
  const LOGS = staff([], true);
  /** Business data (which servers add/remove the bot, errors): Administrators and Developers. */
  const botLogs: Overwrite[] = [...ow(everyone, [], [V.ViewChannel]), ...ow(R.dev, READ, STAFF_POST)];

  // ================================================== channel helpers
  const editChannel = async (id: string, data: Json, label: string) => {
    if (!channels.some((c) => c.id === id)) return console.warn(`  ! ${label}: channel ${id} not found`);
    log(`edit ${label}`);
    const updated = await api<Json>("patch", Routes.channel(id), data).catch((e) => warn(label, e));
    if (updated) channels = channels.map((c) => (c.id === id ? updated : c));
  };
  const mention = (id: string) => `<#${id}>`;

  // ========================================================= START HERE
  await editChannel(ID.catStart, { name: "📌 START HERE", permission_overwrites: readOnly() }, "category START HERE");
  await editChannel(ID.welcome, { name: "👋・welcome", parent_id: ID.catStart, permission_overwrites: readOnly(), topic: "Start here: what Bypass is, how to add it, the roles, and where everything is." }, "#welcome");
  await editChannel(ID.rules, { name: "📜・rules", parent_id: ID.catStart, permission_overwrites: readOnly(), topic: "Server rules. By chatting here you accept them and Discord's Terms of Service." }, "#rules");
  await editChannel(ID.announcements, { name: "📣・announcements", parent_id: ID.catStart, permission_overwrites: readOnly(true), topic: "Releases, outages and big news. Press Follow to get these posts in your own server." }, "#announcements");
  await editChannel(ID.changelog, { name: "🆕・changelog", parent_id: ID.catStart, permission_overwrites: readOnly(true), topic: "Every Bypass update, posted automatically. Press Follow to get it in your server." }, "#changelog");
  await editChannel(ID.status, { name: "📡・status", parent_id: ID.catStart, permission_overwrites: readOnly(), topic: "Live bot status, refreshed every 5 minutes. Pick 📡 Status Alerts in Channels & Roles to get pinged during outages." }, "#status");
  await editChannel(ID.votes, { name: "🗳️・votes", parent_id: ID.catStart, permission_overwrites: readOnly(), topic: "Thanks for every top.gg vote. /vote unlocks 24/7 and studio quality for 12 hours." }, "#votes");
  await editChannel(ID.github, { name: "📦・github", parent_id: ID.catStart, permission_overwrites: readOnly(), topic: "Commits and releases from github.com/eduair94/music-bot." }, "#github");

  // ============================================================ SUPPORT
  await editChannel(ID.catSupport, { name: "🆘 SUPPORT", permission_overwrites: supportArea }, "category SUPPORT");
  await editChannel(ID.faq, { name: "❓・faq", parent_id: ID.catSupport, permission_overwrites: readOnly(), topic: "Answers to the most common questions. Read this before opening a post in #help." }, "#faq");
  await editChannel(
    ID.help,
    {
      name: "🙋・help",
      parent_id: ID.catSupport,
      permission_overwrites: supportArea,
      topic: "One problem per post. Include the command you ran, your server ID, what happened and when. Tag it ✅ Solved when it's fixed.",
      rate_limit_per_user: 300, // one new post every 5 minutes
      default_thread_rate_limit_per_user: 0,
      default_auto_archive_duration: 4320
    },
    "forum #help"
  );
  await editChannel(
    ID.tickets,
    {
      name: "🎫・tickets",
      parent_id: ID.catSupport,
      permission_overwrites: ticketPanel,
      rate_limit_per_user: 0,
      topic: "Private help for billing, Patreon or anything you can't post in public. Pick a topic below: only you and staff see the ticket."
    },
    "#tickets"
  );

  // ========================================================== COMMUNITY
  await editChannel(ID.catCommunity, { name: "💬 COMMUNITY", permission_overwrites: community }, "category COMMUNITY");
  await editChannel(ID.general, { name: "💬・general", parent_id: ID.catCommunity, permission_overwrites: community, rate_limit_per_user: 3, topic: `Chat about anything. Bot problems go in ${mention(ID.help)}, commands in ${mention(ID.botCommands)}.` }, "#general");
  await editChannel(
    ID.suggestions,
    {
      name: "💡・suggestions",
      parent_id: ID.catCommunity,
      permission_overwrites: community,
      rate_limit_per_user: 900, // one new idea every 15 minutes
      topic: "One idea per post. Search first and 👍 existing ideas instead of reposting. Staff tags posts Planned, Done or Declined."
    },
    "forum #suggestions"
  );

  // ======================================================== TRY THE BOT
  await editChannel(ID.catTry, { name: "🎵 TRY THE BOT", permission_overwrites: playground }, "category TRY THE BOT");
  await editChannel(
    ID.botCommands,
    { name: "🎛️・bot-commands", parent_id: ID.catTry, permission_overwrites: playground, rate_limit_per_user: 3, topic: "Use Bypass and other bots here. Join 🎵 Music Lounge, then /play. The player card appears in the voice channel chat." },
    "#bot-commands"
  );
  await editChannel(ID.musicLounge, { name: "🎵・Music Lounge", parent_id: ID.catTry, permission_overwrites: listeningRoom, bitrate: 96000, user_limit: 0 }, "voice Music Lounge (listen-only, 96 kbps)");
  await editChannel(ID.hangout, { name: "🗣️・Hangout", parent_id: ID.catTry, permission_overwrites: playground, bitrate: 96000 }, "voice Hangout (96 kbps)");
  await editChannel(ID.afk, { name: "💤・AFK", parent_id: ID.catTry, permission_overwrites: afkRoom }, "voice AFK");

  // ============================================================== STAFF
  await editChannel(ID.catStaff, { name: "🛡️ STAFF", permission_overwrites: STAFF_ALL }, "category STAFF");
  await editChannel(ID.staffNews, { name: "📪・staff-news", parent_id: ID.catStaff, permission_overwrites: staff(["dev"]), topic: "Staff announcements: policy changes, schedules, releases before they go public. Admins and developers post." }, "#staff-news");
  await editChannel(ID.staffChat, { name: "🎓・staff-chat", parent_id: ID.catStaff, permission_overwrites: STAFF_ALL, topic: "Staff discussion. Keep user data, IDs and DM screenshots here, never in public channels." }, "#staff-chat");
  await editChannel(ID.staffCommands, { name: "🔐・staff-commands", parent_id: ID.catStaff, permission_overwrites: STAFF_ALL, topic: "Moderation and bot commands (Carl-bot, Ticket Tool, Bypass tests)." }, "#staff-commands");
  await editChannel(ID.discordUpdates, { name: "📥・discord-updates", parent_id: ID.catStaff, permission_overwrites: staff([]), topic: "Notices Discord sends to Community server admins." }, "#discord-updates");
  await editChannel(ID.modLogs, { name: "📛・mod-logs", parent_id: ID.catStaff, permission_overwrites: LOGS, topic: "AutoMod blocks, raid and safety alerts from Discord, and Carl-bot moderation cases." }, "#mod-logs");
  await editChannel(ID.messageLogs, { name: "📝・message-logs", parent_id: ID.catStaff, permission_overwrites: LOGS, topic: "Deleted, edited and purged messages (Carl-bot)." }, "#message-logs (was utility-logs)");
  await editChannel(ID.memberLogs, { name: "👥・member-logs", parent_id: ID.catStaff, permission_overwrites: LOGS, topic: "Joins and leaves, role and nickname changes, bans and timeouts (Carl-bot)." }, "#member-logs (was invites)");
  await editChannel(ID.serverLogs, { name: "🗂️・server-logs", parent_id: ID.catStaff, permission_overwrites: LOGS, topic: "Channel, role, emoji, server and voice changes (Carl-bot)." }, "#server-logs (was community-news)");
  await editChannel(ID.staffVoice, { name: "🔒・Staff Voice", parent_id: ID.catStaff, permission_overwrites: STAFF_ALL, bitrate: 96000 }, "voice Staff Voice (was Private, open to everyone)");

  // =========================================================== BOT LOGS
  await editChannel(ID.catBotLogs, { name: "🔧 BOT LOGS", permission_overwrites: botLogs }, "category BOT LOGS");
  await editChannel(ID.guildJoin, { name: "📥・guild-join", parent_id: ID.catBotLogs, permission_overwrites: botLogs, topic: "Servers that add Bypass, posted by the bot." }, "#guild-join");
  await editChannel(ID.guildLeave, { name: "📤・guild-leave", parent_id: ID.catBotLogs, permission_overwrites: botLogs, topic: "Servers that remove Bypass, posted by the bot." }, "#guild-leave");
  await editChannel(ID.botErrors, { name: "📛・bot-errors", parent_id: ID.catBotLogs, permission_overwrites: botLogs, topic: "Bot errors, at most 5 per 10 minutes, duplicates merged." }, "#bot-errors");

  // =========================================================== ordering
  const order = [
    ID.catStart, ID.welcome, ID.rules, ID.announcements, ID.changelog, ID.status, ID.votes, ID.github,
    ID.catSupport, ID.faq, ID.help, ID.tickets,
    ID.catCommunity, ID.general, ID.suggestions,
    ID.catTry, ID.botCommands, ID.musicLounge, ID.hangout, ID.afk,
    ID.catStaff, ID.staffNews, ID.staffChat, ID.staffCommands, ID.discordUpdates, ID.modLogs, ID.messageLogs, ID.memberLogs, ID.serverLogs, ID.staffVoice,
    ID.catBotLogs, ID.guildJoin, ID.guildLeave, ID.botErrors
  ].filter((id) => channels.some((c) => c.id === id));
  log(`reorder ${order.length} channels`);
  // Parents are set by the edits above; the bulk route accepts one parent change per call.
  await api("patch", Routes.guildChannels(GUILD), order.map((id, position) => ({ id, position })));

  // ===================================================== brand assets
  let emoji = ((guild.emojis ?? []) as Json[]).find((e) => e.name === "bypass");
  const dataUri = (file: string) => `data:image/png;base64,${fs.readFileSync(path.join(BRAND, file)).toString("base64")}`;
  if (ASSETS) {
    log("server icon ← assets/brand/bypass-logo-1024.png");
    await api("patch", Routes.guild(GUILD), { icon: dataUri("bypass-logo-1024.png") }).catch((e) => warn("icon", e));
    if (!emoji) {
      log("emoji :bypass: ← assets/brand/bypass-emoji-256.png");
      emoji = (await api<Json>("post", Routes.guildEmojis(GUILD), { name: "bypass", image: dataUri("bypass-emoji-256.png") }).catch((e) => warn("emoji", e))) ?? undefined;
    }
  }
  const logo = emoji?.id ? `<:bypass:${emoji.id}>` : "🎶";

  // =================================================== guild settings
  log("Community settings, system messages, boost bar, description");
  await api("patch", Routes.guild(GUILD), {
    features: [...new Set([...(guild.features as string[]), "COMMUNITY"])],
    verification_level: Math.max(2, guild.verification_level),
    explicit_content_filter: 2,
    default_message_notifications: 1,
    rules_channel_id: ID.rules,
    public_updates_channel_id: ID.discordUpdates,
    safety_alerts_channel_id: ID.modLogs,
    system_channel_id: ID.general,
    // keep "X joined" messages; drop the wave-sticker reply prompt and setup tips
    system_channel_flags: (1 << 2) | (1 << 3),
    afk_channel_id: ID.afk,
    afk_timeout: 300,
    premium_progress_bar_enabled: true,
    description: "Official home of Bypass, the hi-fi Discord music bot. Get help, report bugs, suggest features and try the bot.",
    preferred_locale: "en-US"
  });

  for (const [label, id] of [["#announcements", ID.announcements], ["#changelog", ID.changelog], ["#status", ID.status]] as const) {
    const ch = channels.find((c) => c.id === id);
    if (ch && ch.type !== ChannelType.GuildAnnouncement) {
      log(`convert ${label} to announcement channel`);
      await api("patch", Routes.channel(id), { type: ChannelType.GuildAnnouncement }).catch((e) => warn(label, e));
    }
  }

  log("server widget → #welcome");
  await api("patch", `/guilds/${GUILD}/widget`, { enabled: true, channel_id: ID.welcome }).catch((e) => warn("widget", e));

  // A permanent invite that lands in #welcome (the legacy one lands in #tickets).
  const invites = (await rest.get(Routes.guildInvites(GUILD))) as Json[];
  let welcomeInvite = invites.find((i) => i.channel?.id === ID.welcome && i.max_age === 0 && i.max_uses === 0);
  if (!welcomeInvite) {
    log("create permanent invite to #welcome");
    welcomeInvite = await api<Json>("post", Routes.channelInvites(ID.welcome), { max_age: 0, max_uses: 0, unique: true });
  }
  if (welcomeInvite) console.log(`  welcome invite: https://discord.gg/${welcomeInvite.code}${SUPPORT_INVITE_URL.endsWith(welcomeInvite.code) ? " (in shared/links.ts)" : " ← put this in shared/links.ts"}`);

  log("welcome screen");
  await api("patch", `/guilds/${GUILD}/welcome-screen`, {
    enabled: true,
    description: "Home of Bypass, the hi-fi music bot. Start here:",
    welcome_channels: [
      { channel_id: ID.rules, description: "Read the rules", emoji_name: "📜" },
      { channel_id: ID.faq, description: "Quick answers to common questions", emoji_name: "❓" },
      { channel_id: ID.help, description: "Get help with the bot", emoji_name: "🙋" },
      { channel_id: ID.botCommands, description: "Try the bot yourself", emoji_name: "🎛️" },
      { channel_id: ID.announcements, description: "News and releases", emoji_name: "📣" }
    ]
  });

  // Onboarding. Prompt and option IDs are reused by title so members keep their picks.
  log("onboarding");
  const current = (await rest.get(`/guilds/${GUILD}/onboarding`).catch(() => ({ prompts: [] }))) as Json;
  let sf = 1480000000000000000n;
  const nextId = () => (sf++).toString();
  const withIds = (prompts: Json[]) =>
    prompts.map((p) => {
      const old = (current.prompts as Json[]).find((x) => x.title === p.title);
      return {
        id: old?.id ?? nextId(),
        ...p,
        options: p.options.map((o: Json) => ({ id: (old?.options as Json[] | undefined)?.find((x) => x.title === o.title)?.id ?? nextId(), ...o }))
      };
    });
  await api("put", `/guilds/${GUILD}/onboarding`, {
    enabled: true,
    mode: 0,
    // Every public channel: with onboarding on, channels left out are hidden from new members.
    default_channel_ids: [
      ID.welcome, ID.rules, ID.announcements, ID.changelog, ID.status, ID.votes, ID.github,
      ID.faq, ID.help, ID.tickets, ID.general, ID.suggestions, ID.botCommands, ID.musicLounge, ID.hangout
    ],
    prompts: withIds([
      {
        type: 0,
        title: "What brings you here?",
        single_select: false,
        required: false,
        in_onboarding: true,
        options: [
          { title: "I need help with the bot", description: "Show me #help and #faq", emoji: { name: "🙋" }, channel_ids: [ID.help, ID.faq], role_ids: [] },
          { title: "I run a server with Bypass", description: "Show me the playground and updates", emoji: { name: "🎛️" }, channel_ids: [ID.botCommands, ID.changelog], role_ids: [] },
          { title: "I want to suggest features", description: "Show me #suggestions", emoji: { name: "💡" }, channel_ids: [ID.suggestions], role_ids: [] },
          { title: "Just hanging out", description: "Chat and music", emoji: { name: "💬" }, channel_ids: [ID.general, ID.musicLounge], role_ids: [] }
        ]
      },
      {
        type: 0,
        title: "Which pings do you want?",
        single_select: false,
        required: false,
        in_onboarding: true,
        options: [
          { title: "Updates", description: "New features and releases", emoji: { name: "📣" }, role_ids: [updatesRole.id], channel_ids: [] },
          { title: "Status alerts", description: "When the bot has problems or maintenance", emoji: { name: "📡" }, role_ids: [statusRole.id], channel_ids: [] }
        ]
      }
    ])
  }).catch((e) => warn("onboarding", e));

  // Server Guide (welcome sign from Bypass + 5 new-member to-dos) is set in
  // Server Settings → Onboarding → Server Guide: the endpoint rejects bot tokens
  // ("Bots cannot use this endpoint"). Configured by the owner on 2026-11-26.

  // Rules screening: members accept the rules before they can talk.
  log("rules screening");
  await api("patch", `/guilds/${GUILD}/member-verification`, {
    enabled: true,
    description: "Bypass Hi-Fi Music Bot Support Server",
    form_fields: [{ field_type: "TERMS", label: "Read and agree to the server rules", required: true, values: RULES.map(([a, b]) => `${a} ${b}`) }]
  }).catch((e) => warn("rules screening", e));

  // ============================================================ AutoMod
  const existingRules: Json[] = (await rest.get(`/guilds/${GUILD}/auto-moderation/rules`)) as Json[];
  const inviteCodes = [...new Set([LEGACY_INVITE, SUPPORT_INVITE_URL.split("/").pop()!, welcomeInvite?.code].filter(Boolean))] as string[];
  const block = { type: 1, metadata: { custom_message: "Blocked by AutoMod. If this was a mistake, ask a moderator." } };
  const alert = { type: 2, metadata: { channel_id: ID.modLogs } };
  const amRules: Json[] = [
    { name: "Block spam", event_type: 1, trigger_type: 3, actions: [block, alert] },
    { name: "Block mention spam", event_type: 1, trigger_type: 5, trigger_metadata: { mention_total_limit: 5, mention_raid_protection_enabled: true }, actions: [block, alert, { type: 3, metadata: { duration_seconds: 600 } }] },
    { name: "Block slurs and sexual content", event_type: 1, trigger_type: 4, trigger_metadata: { presets: [2, 3] }, actions: [block, alert] },
    {
      name: "Block other server invites",
      event_type: 1,
      trigger_type: 1,
      trigger_metadata: {
        keyword_filter: ["*discord.gg/*", "*discord.com/invite/*", "*discordapp.com/invite/*", "*dsc.gg/*"],
        allow_list: inviteCodes.flatMap((c) => [`discord.gg/${c}`, `discord.com/invite/${c}`])
      },
      actions: [block, alert]
    },
    {
      name: "Block scam links",
      event_type: 1,
      trigger_type: 1,
      trigger_metadata: { keyword_filter: ["*free nitro*", "*nitro gift*", "*steamcommunity.ru*", "*discord-gift*", "*dlscord*", "*discorcl*"] },
      actions: [block, alert, { type: 3, metadata: { duration_seconds: 3600 } }]
    },
    {
      // Names that pose as staff are the usual start of DM scams.
      name: "Block staff impersonation in names",
      event_type: 2,
      trigger_type: 6,
      trigger_metadata: { keyword_filter: ["*bypass staff*", "*bypass support*", "*bypass admin*", "*bypass mod*", "*discord staff*", "*discord support*", "*discord moderator*", "*discord admin*", "*discord trust*", "*discord safety*"] },
      actions: [{ type: 4 }]
    }
  ];
  for (const rule of amRules) {
    const exists = existingRules.find((r) => r.name === rule.name || (rule.trigger_type !== 1 && r.trigger_type === rule.trigger_type));
    const body: Json = { ...rule, enabled: true, exempt_roles: staffIds };
    if (exists) {
      log(`update AutoMod: ${rule.name}`);
      await api("patch", `/guilds/${GUILD}/auto-moderation/rules/${exists.id}`, { name: body.name, trigger_metadata: body.trigger_metadata, actions: body.actions, enabled: true, exempt_roles: staffIds }).catch(async (e) => {
        warn(`${rule.name} (creating instead)`, e);
        await api("post", `/guilds/${GUILD}/auto-moderation/rules`, body).catch((e2) => warn(rule.name, e2));
      });
    } else {
      log(`create AutoMod: ${rule.name}`);
      await api("post", `/guilds/${GUILD}/auto-moderation/rules`, body).catch((e) => warn(rule.name, e));
    }
  }

  // ================================================ bot-managed messages
  const replaceBotMessages = async (channelId: string, components: ContainerBuilder[], label: string) => {
    log(`post ${label}`);
    if (!APPLY) return;
    const msgs: Json[] = (await rest.get(Routes.channelMessages(channelId), { query: new URLSearchParams({ limit: "50" }) })) as Json[];
    for (const m of msgs.filter((m) => m.author.id === me.id)) await rest.delete(Routes.channelMessage(channelId, m.id)).catch(() => undefined);
    for (const c of components) {
      await rest.post(Routes.channelMessages(channelId), { body: { components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowed_mentions: { parse: [] } } });
    }
  };
  const accent = 0x8b5cf6; // the logo's violet
  const ch = mention;

  const welcome = new ContainerBuilder()
    .setAccentColor(accent)
    .addTextDisplayComponents((t) =>
      t.setContent(
        `# ${logo} Welcome to Bypass\nBypass is a hi-fi music bot for Discord. It plays YouTube, Spotify, SoundCloud, Apple Music and Deezer, with a button player that never times out, autoplay radio, lyrics, effects and 28 languages.`
      )
    )
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          "**Find your way**",
          `${ch(ID.rules)} — read before chatting`,
          `${ch(ID.faq)} — quick answers`,
          `${ch(ID.help)} — one post per problem`,
          `${ch(ID.tickets)} — private help for billing and Patreon`,
          `${ch(ID.suggestions)} — ideas and votes`,
          `${ch(ID.botCommands)} + ${ch(ID.musicLounge)} — try Bypass here`,
          `${ch(ID.announcements)} · ${ch(ID.changelog)} · ${ch(ID.status)} — news, updates and status`,
          "",
          "-# Pick your pings anytime in **Channels & Roles** at the top of the channel list. Hablamos español también."
        ].join("\n")
      )
    )
    .addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Add Bypass").setEmoji("➕").setURL(botInviteUrl()),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Website").setEmoji("🌐").setURL(SITE_URL),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Commands").setEmoji("📖").setURL(`${SITE_URL}/commands`),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Vote").setEmoji("🗳️").setURL(TOPGG_VOTE_URL),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Become a Founder").setEmoji("⭐").setURL(PATREON_URL)
      )
    );

  const roleMention = (name: string) => {
    const r = roleByName(name);
    return r ? `<@&${r.id}>` : `**${name}**`;
  };
  const boosterRole = roles.find((r) => r.tags && "premium_subscriber" in r.tags);
  const boosterMention = boosterRole ? `<@&${boosterRole.id}>` : "**💎 Server Booster**";
  const rolesCard = new ContainerBuilder()
    .setAccentColor(accent)
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          "## 🎭 Roles",
          `${roleMention("Administrators")} ${roleMention("Developers")} — build Bypass and run this server`,
          `${roleMention("Moderators")} — keep the server safe`,
          `${roleMention("Support")} — answer questions in ${ch(ID.help)} and tickets`,
          `${roleMention("Founders")} — support Bypass on Patreon (synced automatically)`,
          `${boosterMention} — boosts this server (Discord adds the role)`,
          `${roleMention("Partners")} — communities we work with`,
          `${roleMention("Server Owners")} — you own a server that uses Bypass (synced every hour)`,
          `${roleMention("Voter")} — voted on top.gg in the last 12 hours`,
          `${roleMention("📣 Updates")} ${roleMention("📡 Status Alerts")} — optional pings, pick them in Channels & Roles`
        ].join("\n")
      )
    )
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          "## 🛡️ Stay safe",
          "Staff will never DM you first, ask for your password or token, or ask you to pay anywhere except Patreon.",
          "Bypass never needs Administrator in your server.",
          `If someone DMs you claiming to be staff, don't click anything and report them in ${ch(ID.tickets)}.`
        ].join("\n")
      )
    );

  const boostCard = new ContainerBuilder()
    .setAccentColor(0xf47fff)
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          "## 💎 Boost perks",
          "Boosting this server helps us grow and unlocks, for as long as your boost lasts:",
          "• **Founder perks in Bypass, in every server you use it:** 24/7 mode, studio quality (320 kbps), no song-length limit and audio filters",
          `• **Priority tickets** in ${ch(ID.tickets)}`,
          `• The ${boosterMention} role, shown separately in the member list`,
          "• The private 💎 booster lounge",
          "",
          "-# Perks switch on within 10 minutes of boosting and end when the boost ends. Nothing to link."
        ].join("\n")
      )
    );

  const rulesCard = new ContainerBuilder()
    .setAccentColor(accent)
    .addTextDisplayComponents((t) => t.setContent("# 📜 Rules"))
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          ...RULES.map(([a, b], i) => {
            const text = `${a} ${b}`
              .replace("#help", ch(ID.help))
              .replace("#suggestions", ch(ID.suggestions))
              .replace("#bot-commands", ch(ID.botCommands))
              .replace("discord.com/terms · discord.com/guidelines", "[Terms](https://discord.com/terms) · [Guidelines](https://discord.com/guidelines)");
            return `**${i + 1}.** ${text.replace(a, `**${a}**`)}`;
          }),
          "",
          `-# Moderators act at their discretion: warning, timeout, then ban. Serious violations go straight to a ban. Report problems in ${ch(ID.tickets)}.`
        ].join("\n")
      )
    );

  const faqCard = new ContainerBuilder()
    .setAccentColor(accent)
    .addTextDisplayComponents((t) => t.setContent("# ❓ Frequently asked questions"))
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          "**The bot doesn't join or play**",
          "Join a voice channel first, then `/play song:<name or link>`. Check that Bypass has **Connect** and **Speak** in that channel. If an admin set allowed channels, use one of those.",
          "",
          "**Audio sounds muffled or quiet**",
          "Discord limits audio to the voice channel's bitrate. Raise it in the channel settings (up to 96 kbps, more with boosts) and check `/volume`.",
          "",
          "**How do I keep music going?**",
          "`/autoplay` queues related songs when the queue ends; `/radio song:<name>` starts an endless station. `/247` keeps the bot in the channel around the clock (Founder, or 12 h after a vote with `/vote`).",
          "",
          "**Only some people should control the music**",
          "Set a DJ role with `/settings djrole`. Without one, anyone in the voice channel can use the controls.",
          "",
          "**Change the language**",
          "Bypass follows each member's Discord language. Admins can force one with `/language`.",
          "",
          "**Spotify / Apple Music / Deezer links**",
          "Paste them in `/play`. Bypass finds each song on YouTube and plays it; playlists and albums work too.",
          "",
          "**Lyrics**",
          "Press 🎤 on the player, or `/lyrics` (also works in DMs if you install Bypass to your account).",
          "",
          "**Premium**",
          "Founder is $3/month on Patreon: 24/7, studio quality and no song-length limit. Link your Discord in Patreon, then run `/premium link`. Boosting this server gives the same perks while the boost lasts.",
          "",
          `-# Still stuck? Open a post in ${ch(ID.help)} with what you ran, your server ID and the time it happened.`
        ].join("\n")
      )
    );

  const ticketsCard = new ContainerBuilder()
    .setAccentColor(accent)
    .addTextDisplayComponents((t) =>
      t.setContent(
        "# 🎫 Private support\nFor things you can't post in public: billing, Patreon, reporting a member or a private bug report. Pick a topic and Bypass opens a private thread that only you and staff can see."
      )
    )
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) =>
      t.setContent(`-# Questions about the bot get answered faster in ${ch(ID.help)}, where the whole community can help. One open ticket per member.`)
    )
    .addActionRowComponents((row) =>
      row.setComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ticket:open")
          .setPlaceholder("Choose a topic to open a ticket")
          .addOptions(Object.entries(TICKET_TOPICS).map(([value, topic]) => ({ value, label: topic.label, description: topic.description, emoji: { name: topic.emoji } })))
      )
    );

  // Tickets are handled by Bypass now; clear the old Ticket Tool setup output.
  if (APPLY) {
    const msgs: Json[] = (await rest.get(Routes.channelMessages(ID.tickets), { query: new URLSearchParams({ limit: "50" }) })) as Json[];
    for (const m of msgs.filter((m) => m.author.id === TICKET_TOOL)) {
      log(`delete Ticket Tool message ${m.id}`);
      await rest.delete(Routes.channelMessage(ID.tickets, m.id)).catch((e) => warn("ticket tool message", e));
    }
  }

  await replaceBotMessages(ID.welcome, [welcome, rolesCard, boostCard], "#welcome cards");
  await replaceBotMessages(ID.tickets, [ticketsCard], "#tickets panel");
  await replaceBotMessages(ID.rules, [rulesCard], "#rules card");
  await replaceBotMessages(ID.faq, [faqCard], "#faq card");

  console.log(APPLY ? "\nDone." : "\nDry run. Pass --apply to make these changes.");
}

main().catch((e) => {
  console.error(e?.rawError ? JSON.stringify(e.rawError).slice(0, 800) : e?.message ?? e);
  process.exit(1);
});
