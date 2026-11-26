/**
 * Configure the official support server to current Discord best practices.
 * Idempotent: finds things by ID or name, creates what's missing, renames and
 * moves the rest. Only deletes legacy channels that hold no human messages.
 *
 *   TOKEN=... npx ts-node --transpile-only scripts/setupSupportServer.ts [--apply]
 *
 * Without --apply it prints the plan. The bot must be an administrator there.
 */
import {
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  OverwriteType,
  PermissionFlagsBits,
  REST,
  Routes,
  SeparatorSpacingSize
} from "discord.js";
import { botInviteUrl, PATREON_URL, SITE_URL, SUPPORT_INVITE_URL, TOPGG_VOTE_URL } from "../shared/links";

const GUILD = "1458199268564406487";
const APPLY = process.argv.includes("--apply");
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);
const log = (...a: unknown[]) => console.log(APPLY ? "•" : "(plan)", ...a);

// Existing IDs (from scripts/inspectGuild.ts, 2026-11-26)
const ID = {
  catImportant: "1458199270006980702",
  information: "1458199270006980703",
  announcements: "1458199270006980704",
  changelog: "1458199270006980705",
  botStatus: "1458199270006980706",
  githubFeeds: "1458199270006980707",
  joinsLeaves: "1458199270183407748",
  catMain: "1458199270183407749",
  general: "1458199270183407750",
  support: "1458199270183407751",
  suggestionsText: "1458199270183407752",
  bugReports: "1458199270183407753",
  commands: "1458199270183407754",
  catVoice: "1458199270183407755",
  voiceGeneral: "1458199270183407756",
  voiceMusic: "1458199270183407757",
  voicePrivate: "1458199270359564423",
  voiceAfk: "1458199270359564424",
  catStaff: "1458199270359564425",
  discordUpdates: "1458199270359564430",
  modLogs: "1458199270359564431",
  catBotLogs: "1458199270556434598"
};

const V = PermissionFlagsBits;
const bits = (...p: bigint[]) => p.reduce((a, b) => a | b, 0n).toString();

type Json = Record<string, any>;

async function api<T = any>(method: "get" | "post" | "patch" | "put" | "delete", route: `/${string}`, body?: unknown, reason?: string): Promise<T> {
  if (method !== "get" && !APPLY) return undefined as T;
  return (await (rest as any)[method](route, { body, reason: reason ?? "Support server setup" })) as T;
}

async function main() {
  const guild = (await rest.get(Routes.guild(GUILD))) as Json;
  let channels: Json[] = (await rest.get(Routes.guildChannels(GUILD))) as Json[];
  let roles: Json[] = (await rest.get(Routes.guildRoles(GUILD))) as Json[];
  const me = (await rest.get(Routes.user("@me"))) as Json;
  const byName = (name: string) => channels.find((c) => c.name === name);
  const roleByName = (name: string) => roles.find((r) => r.name === name);
  const everyone = GUILD;

  // ---------------------------------------------------------------- roles
  const staffRoleNames = ["Administrators", "Moderators", "Developers", "Support"];
  const staffRoles = staffRoleNames.map(roleByName).filter(Boolean) as Json[];
  const staffIds = staffRoles.map((r) => r.id);

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
    log(`rename role Patreons → Founders`);
    await api("patch", Routes.guildRole(GUILD, patreons.id), { name: "Founders" });
    patreons.name = "Founders";
  }
  // @everyone: a safe baseline (no creating emojis/events, no @everyone pings,
  // no management). Same as Discord's "Stop @everyone spam" recommendation.
  log("@everyone safe permission baseline");
  await api("patch", Routes.guildRole(GUILD, GUILD), {
    permissions: bits(
      V.ViewChannel, V.CreateInstantInvite, V.ChangeNickname, V.SendMessages, V.SendMessagesInThreads, V.CreatePublicThreads,
      V.EmbedLinks, V.AttachFiles, V.AddReactions, V.UseExternalEmojis, V.UseExternalStickers, V.ReadMessageHistory,
      V.UseApplicationCommands, V.Connect, V.Speak, V.Stream, V.UseVAD, V.UseEmbeddedActivities, V.UseSoundboard,
      V.UseExternalSounds, V.SendVoiceMessages, V.SendPolls, V.UseExternalApps, V.RequestToSpeak
    )
  });

  const updatesRole = await ensureRole("📣 Updates", { color: 0x5865f2, mentionable: false, hoist: false, permissions: "0" });
  const statusRole = await ensureRole("📡 Status Alerts", { color: 0xed4245, mentionable: false, hoist: false, permissions: "0" });
  const ownersRole = await ensureRole("Server Owners", { color: 0xf8aa2a, mentionable: false, hoist: true, permissions: "0" });

  // Server Owners sits just under Partners in the member list.
  const partners = roleByName("Partners");
  if (partners && ownersRole?.id && !String(ownersRole.id).startsWith("<")) {
    log(`position Server Owners under Partners`);
    await api("patch", Routes.guildRoles(GUILD), [{ id: ownersRole.id, position: Math.max(1, partners.position - 1) }]);
  }

  // ------------------------------------------------------ permission sets
  const readOnly = [
    { id: everyone, type: OverwriteType.Role, allow: bits(V.ViewChannel, V.ReadMessageHistory, V.AddReactions), deny: bits(V.SendMessages, V.SendMessagesInThreads, V.CreatePublicThreads, V.CreatePrivateThreads) },
    ...staffIds.map((id) => ({ id, type: OverwriteType.Role, allow: bits(V.SendMessages, V.SendMessagesInThreads), deny: "0" })),
    { id: me.id, type: OverwriteType.Member, allow: bits(V.ViewChannel, V.SendMessages, V.EmbedLinks, V.ManageMessages), deny: "0" }
  ];
  const staffOnly = [
    { id: everyone, type: OverwriteType.Role, allow: "0", deny: bits(V.ViewChannel) },
    ...staffIds.map((id) => ({ id, type: OverwriteType.Role, allow: bits(V.ViewChannel, V.SendMessages, V.ReadMessageHistory), deny: "0" })),
    { id: me.id, type: OverwriteType.Member, allow: bits(V.ViewChannel, V.SendMessages, V.EmbedLinks), deny: "0" }
  ];
  const openChat = [
    { id: everyone, type: OverwriteType.Role, allow: bits(V.ViewChannel, V.SendMessages, V.ReadMessageHistory, V.SendMessagesInThreads, V.AddReactions), deny: "0" }
  ];

  // ----------------------------------------------------------- categories
  const editChannel = async (id: string, data: Json, label: string) => {
    log(`edit ${label}: ${JSON.stringify(Object.keys(data))}`);
    const updated = await api<Json>("patch", Routes.channel(id), data);
    if (updated) channels = channels.map((c) => (c.id === id ? updated : c));
  };
  const createChannel = async (data: Json, label: string) => {
    const existing = byName(data.name);
    if (existing) {
      log(`exists ${label} (${existing.id})`);
      return existing;
    }
    log(`create ${label}`);
    const created = await api<Json>("post", Routes.guildChannels(GUILD), data);
    if (created) channels.push(created);
    return created ?? { id: `<${data.name}>`, name: data.name };
  };

  await editChannel(ID.catImportant, { name: "📌 START HERE", permission_overwrites: readOnly }, "category START HERE");
  await editChannel(ID.catMain, { name: "💬 COMMUNITY", permission_overwrites: openChat }, "category COMMUNITY");
  const catSupport = await createChannel({ name: "🆘 SUPPORT", type: ChannelType.GuildCategory, permission_overwrites: openChat }, "category SUPPORT");
  await editChannel(ID.catVoice, { name: "🎵 TRY THE BOT", permission_overwrites: openChat }, "category TRY THE BOT");
  await editChannel(ID.catStaff, { name: "🛡️ STAFF" }, "category STAFF");
  await editChannel(ID.catBotLogs, { name: "🔧 BOT LOGS", permission_overwrites: staffOnly }, "category BOT LOGS");

  // ------------------------------------------------------------ START HERE
  await editChannel(ID.information, { name: "👋・welcome", topic: "What Bypass is, how to add it, and where everything lives.", parent_id: ID.catImportant, permission_overwrites: readOnly }, "#welcome");
  const rules = await createChannel({ name: "📜・rules", type: ChannelType.GuildText, parent_id: ID.catImportant, topic: "Server rules. By chatting here you agree to them.", permission_overwrites: readOnly }, "#rules");
  await editChannel(ID.announcements, { name: "📣・announcements", topic: "Releases, outages and big news about Bypass. Follow it to get posts in your own server.", parent_id: ID.catImportant, permission_overwrites: readOnly }, "#announcements");
  await editChannel(ID.changelog, { name: "🆕・changelog", topic: "Every bot update, posted automatically by Bypass.", parent_id: ID.catImportant, permission_overwrites: readOnly }, "#changelog");
  await editChannel(ID.botStatus, { name: "📡・status", topic: "Live bot status, updated by Bypass every few minutes.", parent_id: ID.catImportant, permission_overwrites: readOnly }, "#status");
  const votes = await createChannel({ name: "🗳️・votes", type: ChannelType.GuildText, parent_id: ID.catImportant, topic: "Thanks to everyone who votes for Bypass. /vote in any server.", permission_overwrites: readOnly }, "#votes");
  await editChannel(ID.githubFeeds, { name: "📦・github", topic: "Commits and releases from github.com/eduair94/music-bot.", parent_id: ID.catImportant, permission_overwrites: readOnly }, "#github");

  // ------------------------------------------------------------- COMMUNITY
  await editChannel(ID.general, { name: "💬・general", topic: "Chat about anything. For bot problems use #help.", parent_id: ID.catMain }, "#general");
  const suggestions = await createChannel(
    {
      name: "💡・suggestions",
      type: ChannelType.GuildForum,
      parent_id: ID.catMain,
      topic: "One idea per post. Search first and 👍 existing ideas instead of reposting. Staff tags posts Planned, Done or Declined.",
      default_reaction_emoji: { emoji_name: "👍" },
      default_sort_order: 0,
      default_forum_layout: 1,
      available_tags: [
        { name: "Feature", emoji_name: "✨" },
        { name: "Improvement", emoji_name: "🛠️" },
        { name: "Planned", emoji_name: "📌", moderated: true },
        { name: "Done", emoji_name: "✅", moderated: true },
        { name: "Declined", emoji_name: "❌", moderated: true }
      ]
    },
    "forum #suggestions"
  );

  // --------------------------------------------------------------- SUPPORT
  const faq = await createChannel({ name: "❓・faq", type: ChannelType.GuildText, parent_id: catSupport.id, topic: "Answers to the most common questions. Read this before opening a post in #help.", permission_overwrites: readOnly }, "#faq");
  const help = await createChannel(
    {
      name: "🙋・help",
      type: ChannelType.GuildForum,
      parent_id: catSupport.id,
      topic: "One problem per post. Include what you ran, your server ID, what happened and when. Mark it ✅ Solved when it's fixed.",
      default_sort_order: 0,
      default_forum_layout: 1,
      flags: 1 << 4, // REQUIRE_TAG
      default_auto_archive_duration: 4320,
      available_tags: [
        { name: "Question", emoji_name: "❓" },
        { name: "Bug", emoji_name: "🐛" },
        { name: "Playback", emoji_name: "🎵" },
        { name: "Setup", emoji_name: "⚙️" },
        { name: "Premium", emoji_name: "⭐" },
        { name: "Solved", emoji_name: "✅" }
      ]
    },
    "forum #help"
  );
  await editChannel(ID.support, { name: "🎫・tickets", topic: "Private help for billing, Patreon or anything you can't post publicly. Open a ticket with the button below.", parent_id: catSupport.id }, "#tickets");

  // ----------------------------------------------------------- TRY THE BOT
  await editChannel(ID.commands, { name: "🎛️・bot-commands", topic: "Try Bypass here: join 🎵 Music Lounge and use /play. The player card appears in this channel.", parent_id: ID.catVoice, rate_limit_per_user: 3 }, "#bot-commands");
  await editChannel(ID.voiceMusic, { name: "🎵・Music Lounge", parent_id: ID.catVoice, user_limit: 0 }, "voice Music Lounge");
  await editChannel(ID.voiceGeneral, { name: "🗣️・Hangout", parent_id: ID.catVoice }, "voice Hangout");
  await editChannel(ID.voiceAfk, { name: "💤・AFK", parent_id: ID.catVoice }, "voice AFK");

  // ------------------------------------------------------------------ STAFF
  await editChannel(ID.modLogs, { name: "📛・mod-logs", topic: "AutoMod alerts, raid alerts and moderation logs." }, "#mod-logs");

  // ------------------------------------------------- legacy empty channels
  for (const [label, id] of [["#suggestions (text)", ID.suggestionsText], ["#bug-reports", ID.bugReports], ["#joins-leaves", ID.joinsLeaves]] as const) {
    const ch = channels.find((c) => c.id === id);
    if (!ch) continue;
    const msgs: Json[] = (await rest.get(Routes.channelMessages(id), { query: new URLSearchParams({ limit: "50" }) })) as Json[];
    const humans = msgs.filter((m) => !m.author.bot).length;
    if (humans > 0) {
      log(`keep ${label}: ${humans} human messages`);
      continue;
    }
    log(`delete empty ${label}`);
    await api("delete", Routes.channel(id));
    channels = channels.filter((c) => c.id !== id);
  }

  // ------------------------------------------------------------- ordering
  const order: [string, string | null][] = [
    [ID.catImportant, null], [ID.information, ID.catImportant], [rules.id, ID.catImportant], [ID.announcements, ID.catImportant], [ID.changelog, ID.catImportant], [ID.botStatus, ID.catImportant], [votes.id, ID.catImportant], [ID.githubFeeds, ID.catImportant],
    [catSupport.id, null], [faq.id, catSupport.id], [help.id, catSupport.id], [ID.support, catSupport.id],
    [ID.catMain, null], [ID.general, ID.catMain], [suggestions.id, ID.catMain],
    [ID.catVoice, null], [ID.commands, ID.catVoice], [ID.voiceMusic, ID.catVoice], [ID.voiceGeneral, ID.catVoice], [ID.voiceAfk, ID.catVoice],
    [ID.catStaff, null], [ID.catBotLogs, null]
  ];
  log(`reorder ${order.length} channels`);
  await api(
    "patch",
    Routes.guildChannels(GUILD),
    // Parents are set by the per-channel edits above; the bulk route accepts only one parent change per call.
    order.filter(([id]) => !id.startsWith("<")).map(([id], position) => ({ id, position }))
  );

  // ----------------------------------------------------- guild settings
  log("enable Community, rules/updates/safety channels, AFK, description");
  await api("patch", Routes.guild(GUILD), {
    features: [...new Set([...(guild.features as string[]), "COMMUNITY"])],
    verification_level: Math.max(2, guild.verification_level),
    explicit_content_filter: 2,
    default_message_notifications: 1,
    rules_channel_id: rules.id,
    public_updates_channel_id: ID.discordUpdates,
    safety_alerts_channel_id: ID.modLogs,
    system_channel_id: ID.general,
    afk_channel_id: ID.voiceAfk,
    afk_timeout: 300,
    description: "Official home of Bypass, the hi-fi Discord music bot. Get help, report bugs, suggest features and try the bot.",
    preferred_locale: "en-US"
  });

  // Announcement channels (followable) need Community first.
  for (const [label, id] of [["#announcements", ID.announcements], ["#changelog", ID.changelog], ["#status", ID.botStatus]] as const) {
    const ch = channels.find((c) => c.id === id);
    if (ch && ch.type !== ChannelType.GuildAnnouncement) {
      log(`convert ${label} to announcement channel`);
      await api("patch", Routes.channel(id), { type: ChannelType.GuildAnnouncement }).catch((e: any) => console.warn(`  ${label}: ${e?.message}`));
    }
  }

  log("welcome screen");
  await api("patch", `/guilds/${GUILD}/welcome-screen`, {
    enabled: true,
    description: "Home of Bypass, the hi-fi music bot. Start here:",
    welcome_channels: [
      { channel_id: rules.id, description: "Read the rules", emoji_name: "📜" },
      { channel_id: faq.id, description: "Quick answers to common questions", emoji_name: "❓" },
      { channel_id: help.id, description: "Get help with the bot", emoji_name: "🙋" },
      { channel_id: ID.commands, description: "Try the bot yourself", emoji_name: "🎛️" },
      { channel_id: ID.announcements, description: "News and releases", emoji_name: "📣" }
    ]
  });

  log("onboarding");
  let sf = 1480000000000000000n;
  const nextId = () => (sf++).toString();
  const withIds = (prompts: Json[]) => prompts.map((p) => ({ id: nextId(), ...p, options: p.options.map((o: Json) => ({ id: nextId(), ...o })) }));
  await api("put", `/guilds/${GUILD}/onboarding`, {
    enabled: true,
    mode: 0,
    default_channel_ids: [ID.information, rules.id, ID.announcements, ID.changelog, ID.botStatus, ID.general, suggestions.id, faq.id, help.id, ID.commands, ID.voiceMusic, ID.voiceGeneral].filter((id) => !id.startsWith("<")),
    prompts: withIds([
      {
        type: 0,
        title: "What brings you here?",
        single_select: false,
        required: false,
        in_onboarding: true,
        options: [
          { title: "I need help with the bot", description: "Show me #help and #faq", emoji: { name: "🙋" }, channel_ids: [help.id, faq.id], role_ids: [] },
          { title: "I run a server with Bypass", description: "Show me the playground and updates", emoji: { name: "🎛️" }, channel_ids: [ID.commands, ID.changelog], role_ids: [] },
          { title: "I want to suggest features", description: "Show me #suggestions", emoji: { name: "💡" }, channel_ids: [suggestions.id], role_ids: [] },
          { title: "Just hanging out", description: "Chat and music", emoji: { name: "💬" }, channel_ids: [ID.general, ID.voiceMusic], role_ids: [] }
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
  }).catch((e: any) => console.warn(`  onboarding: ${e?.message}`));

  // --------------------------------------------------------------- AutoMod
  const existingRules: Json[] = APPLY || true ? ((await rest.get(`/guilds/${GUILD}/auto-moderation/rules`)) as Json[]) : [];
  const amAction = [
    { type: 1, metadata: { custom_message: "Blocked by AutoMod. If this was a mistake, ask a moderator." } },
    { type: 2, metadata: { channel_id: ID.modLogs } }
  ];
  const amRules: Json[] = [
    { name: "Block spam", event_type: 1, trigger_type: 3, actions: amAction.slice(0, 1).concat(amAction[1]) },
    { name: "Block mention spam", event_type: 1, trigger_type: 5, trigger_metadata: { mention_total_limit: 5, mention_raid_protection_enabled: true }, actions: [...amAction, { type: 3, metadata: { duration_seconds: 600 } }] },
    { name: "Block slurs and sexual content", event_type: 1, trigger_type: 4, trigger_metadata: { presets: [2, 3] }, actions: amAction },
    {
      name: "Block other server invites",
      event_type: 1,
      trigger_type: 1,
      trigger_metadata: { keyword_filter: ["*discord.gg/*", "*discord.com/invite/*", "*discordapp.com/invite/*", "*dsc.gg/*"], allow_list: ["discord.gg/hjJQKp5zDU", "discord.com/invite/hjJQKp5zDU"] },
      actions: amAction
    },
    {
      name: "Block scam links",
      event_type: 1,
      trigger_type: 1,
      trigger_metadata: { keyword_filter: ["*free nitro*", "*nitro gift*", "*steamcommunity.ru*", "*discord-gift*", "*dlscord*", "*discorcl*"] },
      actions: [...amAction, { type: 3, metadata: { duration_seconds: 3600 } }]
    }
  ];
  for (const rule of amRules) {
    const exists = existingRules.find((r) => r.name === rule.name || (rule.trigger_type !== 1 && r.trigger_type === rule.trigger_type));
    const body: Json = { ...rule, enabled: true, exempt_roles: staffIds };
    if (exists) {
      log(`update AutoMod: ${rule.name}`);
      await api("patch", `/guilds/${GUILD}/auto-moderation/rules/${exists.id}`, { name: body.name, trigger_metadata: body.trigger_metadata, actions: body.actions, enabled: true, exempt_roles: staffIds }).catch(async (e: any) => {
        console.warn(`  ${rule.name}: ${e?.message}; creating instead`);
        await api("post", `/guilds/${GUILD}/auto-moderation/rules`, body).catch((e2: any) => console.warn(`  ${rule.name}: ${e2?.message}`));
      });
    } else {
      log(`create AutoMod: ${rule.name}`);
      await api("post", `/guilds/${GUILD}/auto-moderation/rules`, body).catch((e: any) => console.warn(`  ${rule.name}: ${e?.message}`));
    }
  }

  // ------------------------------------------------- bot-managed messages
  const replaceBotMessages = async (channelId: string, components: ContainerBuilder[], label: string) => {
    if (String(channelId).startsWith("<")) return;
    log(`post ${label}`);
    if (!APPLY) return;
    const msgs: Json[] = (await rest.get(Routes.channelMessages(channelId), { query: new URLSearchParams({ limit: "50" }) })) as Json[];
    for (const m of msgs.filter((m) => m.author.id === me.id)) await rest.delete(Routes.channelMessage(channelId, m.id)).catch(() => undefined);
    for (const c of components) {
      await rest.post(Routes.channelMessages(channelId), { body: { components: [c.toJSON()], flags: MessageFlags.IsComponentsV2, allowed_mentions: { parse: [] } } });
    }
  };

  const ch = (id: string) => (String(id).startsWith("<") ? "#channel" : `<#${id}>`);
  const accent = 0xf8aa2a;

  const welcome = new ContainerBuilder()
    .setAccentColor(accent)
    .addTextDisplayComponents((t) => t.setContent("# 🎶 Welcome to Bypass\nThe hi-fi music bot for Discord: YouTube, Spotify, SoundCloud, Apple Music and Deezer, a button player that never times out, autoplay radio, lyrics, effects and 28 languages."))
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          "**Start here**",
          `📜 ${ch(rules.id)} — the rules`,
          `❓ ${ch(faq.id)} — quick answers`,
          `🙋 ${ch(help.id)} — ask for help (one post per problem)`,
          `💡 ${ch(suggestions.id)} — ideas and votes`,
          `🎛️ ${ch(ID.commands)} + 🎵 ${ch(ID.voiceMusic)} — try the bot here`,
          `📣 ${ch(ID.announcements)} · 🆕 ${ch(ID.changelog)} · 📡 ${ch(ID.botStatus)} — news, updates and status`,
          "",
          "-# Pick the pings you want in **Channels & Roles** at the top of the channel list. Hablamos español también."
        ].join("\n")
      )
    )
    .addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Add Bypass").setEmoji("➕").setURL(botInviteUrl()),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Website").setEmoji("🌐").setURL(SITE_URL),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Vote").setEmoji("🗳️").setURL(TOPGG_VOTE_URL),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Become a Founder").setEmoji("⭐").setURL(PATREON_URL)
      )
    );

  const rulesCard = new ContainerBuilder()
    .setAccentColor(accent)
    .addTextDisplayComponents((t) => t.setContent("# 📜 Rules"))
    .addTextDisplayComponents((t) =>
      t.setContent(
        [
          "**1. Be respectful.** No harassment, hate speech, discrimination or personal attacks.",
          "**2. Keep it safe for work.** No NSFW, gore or shock content, including names and avatars.",
          "**3. No spam or advertising.** No self-promotion, server invites or unsolicited DMs to members.",
          `**4. Use the right channel.** Help goes in ${ch(help.id)}, ideas in ${ch(suggestions.id)}, bot testing in ${ch(ID.commands)}.`,
          "**5. Don't ping staff for support.** Open a post in #help and someone will answer.",
          "**6. No scams, malicious links, piracy or account trading.**",
          "**7. Follow Discord's [Terms of Service](https://discord.com/terms) and [Community Guidelines](https://discord.com/guidelines).**",
          "",
          "-# Moderators act at their discretion: warning, timeout, then ban. Report problems to a moderator or in 🎫 tickets."
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
          "Founder is $3/month on Patreon: 24/7, studio quality and no song-length limit. Link your Discord in Patreon, then run `/premium link`.",
          "",
          `-# Still stuck? Open a post in ${ch(help.id)} with what you ran, your server ID and the time it happened.`
        ].join("\n")
      )
    );

  await replaceBotMessages(ID.information, [welcome], "#welcome card");
  await replaceBotMessages(rules.id, [rulesCard], "#rules card");
  await replaceBotMessages(faq.id, [faqCard], "#faq card");

  console.log(APPLY ? "\nDone." : "\nDry run. Pass --apply to make these changes.");
}

main().catch((e) => {
  console.error(e?.rawError ? JSON.stringify(e.rawError).slice(0, 800) : e?.message ?? e);
  process.exit(1);
});
