import {
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  ContainerBuilder,
  ForumChannel,
  Guild,
  GuildTextBasedChannel,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorSpacingSize,
  TextChannel,
  ThreadAutoArchiveDuration,
  ThreadChannel
} from "discord.js";
import { Vote } from "../models/Vote";
import { CHANGELOG } from "../shared/changelog";
import { SUPPORT_INVITE_URL } from "../shared/links";
import { TICKET_TOPICS, TicketTopic } from "../shared/tickets";
import { ComponentInteraction, isButton, isStringSelect, registerComponentHandler } from "../structs/componentRouter";
import { formatDuration, truncate } from "../utils/format";
import { DatabaseService } from "./database";
import { TelemetryService } from "./telemetry";

/**
 * Ties the official support server to the bot:
 *  - #status: one message, edited every few minutes with live numbers
 *  - #changelog: each release from shared/changelog.ts, posted once and published
 *  - #votes: a thank-you per vote, plus the Voter role for the 12 h perk window
 *  - Founders role for active patrons, Server Owners role for owners of servers using the bot
 *  - staff #guild-join / #guild-leave / #bot-errors logs
 *  - an automatic first reply on every new #help post
 *  - private tickets: the #tickets panel (posted by scripts/setupSupportServer.ts)
 *    opens a private thread per member, closed with a button
 * Channels and roles are found by name, so the server layout can change
 * without a deploy. Every action is best-effort and never throws.
 */
const SUPPORT_GUILD_ID = process.env.SUPPORT_GUILD_ID || "1458199268564406487";
const STATUS_MARKER = "Bypass status";
/** The logo's violet. */
const ACCENT = 0x8b5cf6;

const channelKey = (name: string) => name.split("・").pop()?.toLowerCase().trim() ?? name.toLowerCase();

export class SupportServerService {
  private static instance: SupportServerService;
  private client: Client | null = null;
  private statusMessage: Message | null = null;
  private lastVoteCheck = new Date();
  private voterExpiry = new Map<string, number>();
  private errorTimes: number[] = [];
  private lastErrorText = "";

  public static getInstance(): SupportServerService {
    if (!this.instance) this.instance = new SupportServerService();
    return this.instance;
  }

  private guild(): Guild | null {
    return this.client?.guilds.cache.get(SUPPORT_GUILD_ID) ?? null;
  }

  private channel(name: string): GuildTextBasedChannel | null {
    const guild = this.guild();
    if (!guild) return null;
    const found = guild.channels.cache.find((c) => channelKey(c.name) === name && c.isTextBased());
    return (found as GuildTextBasedChannel) ?? null;
  }

  private role(name: string) {
    return this.guild()?.roles.cache.find((r) => r.name.replace(/^[^\p{L}\p{N}]+/u, "").trim().toLowerCase() === name.toLowerCase()) ?? null;
  }

  public start(client: Client): void {
    if (this.client) return;
    this.client = client;
    if (!this.guild()) {
      console.log(`[Support] Bot is not in the support server (${SUPPORT_GUILD_ID}); skipping`);
      return;
    }

    const safe = (label: string, fn: () => Promise<unknown>) => () =>
      void fn().catch((error) => console.warn(`[Support] ${label} failed:`, (error as Error)?.message ?? error));

    setTimeout(safe("status", () => this.updateStatus()), 15_000).unref();
    setInterval(safe("status", () => this.updateStatus()), 5 * 60 * 1000).unref();
    setTimeout(safe("changelog", () => this.postChangelog()), 20_000).unref();
    setInterval(safe("votes", () => this.processVotes()), 60_000).unref();
    setTimeout(safe("roles", () => this.syncRoles()), 60_000).unref();
    setInterval(safe("roles", () => this.syncRoles()), 60 * 60 * 1000).unref();

    client.on("guildCreate", (guild) => void this.logGuild(guild, "join").catch(() => undefined));
    client.on("guildDelete", (guild) => void this.logGuild(guild, "leave").catch(() => undefined));
    client.on("threadCreate", (thread, newlyCreated) => {
      if (newlyCreated) void this.welcomeHelpPost(thread).catch(() => undefined);
    });
    registerComponentHandler("ticket", (interaction, args) => this.handleTicket(interaction, args));
    TelemetryService.getInstance().onError((scope, error) => void this.logError(scope, error).catch(() => undefined));
    console.log("[Support] ✅ Linked to the support server");
  }

  // ------------------------------------------------------------ status

  private async updateStatus(): Promise<void> {
    const client = this.client!;
    const channel = this.channel("status");
    if (!channel) return;

    const { DiscordPlayerService } = await import("./discordPlayer");
    const queues = DiscordPlayerService.getInstance().getPlayer()?.nodes.cache;
    const playing = queues ? queues.filter((q) => Boolean(q.currentTrack)).size : 0;
    const users = client.guilds.cache.reduce((n, g) => n + (g.memberCount || 0), 0);
    const ping = Math.max(0, Math.round(client.ws.ping));

    const container = new ContainerBuilder()
      .setAccentColor(0x57f287)
      .addTextDisplayComponents((t) => t.setContent(`### 🟢 ${STATUS_MARKER}: online`))
      .addTextDisplayComponents((t) =>
        t.setContent(
          [
            `**Servers** ${client.guilds.cache.size.toLocaleString("en-US")} · **Members reached** ${users.toLocaleString("en-US")}`,
            `**Playing now** in ${playing} server${playing === 1 ? "" : "s"}`,
            `**Gateway latency** ${ping} ms · **Uptime** ${formatDuration((client.uptime ?? 0))}`,
            `-# Updated <t:${Math.floor(Date.now() / 1000)}:R>. If this stops updating, the bot is down; we post incidents in announcements.`
          ].join("\n")
        )
      );

    const payload = { components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } } as const;
    if (!this.statusMessage) {
      const recent = await channel.messages.fetch({ limit: 20 });
      this.statusMessage =
        recent.find((m) => m.author.id === client.user!.id && JSON.stringify(m.components.map((c) => c.toJSON())).includes(STATUS_MARKER)) ?? null;
    }
    if (this.statusMessage) {
      this.statusMessage = await this.statusMessage.edit(payload as any).catch(() => null);
      if (this.statusMessage) return;
    }
    this.statusMessage = await channel.send(payload as any);
  }

  /** Called on graceful shutdown so the status doesn't say "online" while restarting. */
  public async markRestarting(): Promise<void> {
    if (!this.statusMessage) return;
    const container = new ContainerBuilder()
      .setAccentColor(0xfee75c)
      .addTextDisplayComponents((t) => t.setContent(`### 🟡 ${STATUS_MARKER}: restarting`))
      .addTextDisplayComponents((t) => t.setContent(`-# Since <t:${Math.floor(Date.now() / 1000)}:R>. Usually back within a minute.`));
    await this.statusMessage.edit({ components: [container], flags: MessageFlags.IsComponentsV2 } as any).catch(() => undefined);
  }

  // --------------------------------------------------------- changelog

  private async postChangelog(): Promise<void> {
    const channel = this.channel("changelog");
    if (!channel) return;
    const recent = await channel.messages.fetch({ limit: 50 });
    const posted = new Set<string>();
    for (const m of recent.values()) {
      const text = JSON.stringify(m.components.map((c) => c.toJSON()));
      for (const entry of CHANGELOG) if (text.includes(`v${entry.version}`)) posted.add(entry.version);
    }
    const updatesRole = this.role("Updates");

    for (const entry of CHANGELOG.filter((e) => !posted.has(e.version))) {
      const container = new ContainerBuilder()
        .setAccentColor(ACCENT)
        .addTextDisplayComponents((t) => t.setContent(`## 🆕 v${entry.version} · ${entry.title}`))
        .addTextDisplayComponents((t) => t.setContent(entry.items.map((i) => `• ${i}`).join("\n").slice(0, 3900)))
        .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents((t) =>
          t.setContent(`-# ${entry.date}${updatesRole ? ` · <@&${updatesRole.id}>` : ""} · Questions? ${SUPPORT_INVITE_URL}`)
        );
      const message = await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { roles: updatesRole ? [updatesRole.id] : [] }
      } as any);
      if (channel.type === ChannelType.GuildAnnouncement) await message.crosspost().catch(() => undefined);
      console.log(`[Support] Posted changelog v${entry.version}`);
    }
  }

  // ------------------------------------------------------------- votes

  private async processVotes(): Promise<void> {
    if (!DatabaseService.getInstance().isConnected()) return;
    const guild = this.guild();
    if (!guild) return;
    const since = this.lastVoteCheck;
    this.lastVoteCheck = new Date();
    const voter = this.role("Voter");
    const channel = this.channel("votes");

    const votes = (await Vote.find({ votedAt: { $gt: since } }).sort({ votedAt: 1 }).limit(50).lean()) as any[];
    for (const vote of votes) {
      const until = new Date(vote.perksUntil).getTime();
      if (channel) {
        await channel
          .send({
            content: `🗳️ <@${vote.userId}> voted on **${vote.site}**. Thank you! 24/7 mode and studio quality are on for them until <t:${Math.floor(until / 1000)}:t>.`,
            allowedMentions: { parse: [] }
          })
          .catch(() => undefined);
      }
      if (voter) {
        const added = await guild.members.addRole({ user: vote.userId, role: voter.id, reason: "Voted for Bypass" }).then(() => true).catch(() => false);
        if (added) this.voterExpiry.set(vote.userId, Math.max(this.voterExpiry.get(vote.userId) ?? 0, until));
      }
    }

    // Remove the role when the perk window ends.
    if (voter) {
      for (const [userId, until] of this.voterExpiry) {
        if (until > Date.now()) continue;
        this.voterExpiry.delete(userId);
        await guild.members.removeRole({ user: userId, role: voter.id, reason: "Vote perks expired" }).catch(() => undefined);
      }
    }
  }

  // ------------------------------------------------------------- roles

  private async syncRoles(): Promise<void> {
    const guild = this.guild();
    const client = this.client!;
    if (!guild) return;

    // Server Owners: owners of servers the bot is in (only those who joined the support server).
    const owners = this.role("Server Owners");
    if (owners) {
      const ownerIds = new Set(client.guilds.cache.filter((g) => g.id !== guild.id).map((g) => g.ownerId));
      for (const id of ownerIds) {
        if (owners.members.has(id)) continue;
        await guild.members.addRole({ user: id, role: owners.id, reason: "Owns a server that uses Bypass" }).catch(() => undefined);
      }
      for (const member of owners.members.values()) {
        if (!ownerIds.has(member.id)) await member.roles.remove(owners.id, "No longer owns a server with Bypass").catch(() => undefined);
      }
    }

    // Founders: active patrons with a linked Discord account.
    const founders = this.role("Founders");
    if (founders && DatabaseService.getInstance().isConnected()) {
      const { PatreonUser } = await import("../models/PatreonUser");
      const patrons = (await PatreonUser.find({}, { discordId: 1, patronStatus: 1, pledgeAmountCents: 1 }).lean()) as any[];
      for (const p of patrons) {
        if (!p.discordId) continue;
        const active = p.patronStatus === "active_patron" && (p.pledgeAmountCents ?? 0) > 0;
        if (active) await guild.members.addRole({ user: p.discordId, role: founders.id, reason: "Active Founder on Patreon" }).catch(() => undefined);
        else await guild.members.removeRole({ user: p.discordId, role: founders.id, reason: "No longer an active patron" }).catch(() => undefined);
      }
    }
  }

  // -------------------------------------------------------------- logs

  private async logGuild(guild: Guild, event: "join" | "leave"): Promise<void> {
    if (guild.id === SUPPORT_GUILD_ID) return;
    const channel = this.channel(event === "join" ? "guild-join" : "guild-leave");
    if (!channel) return;
    const total = this.client!.guilds.cache.size;
    const icon = event === "join" ? "📥" : "📤";
    await channel.send({
      content: `${icon} **${truncate(guild.name ?? "Unknown", 80)}** (\`${guild.id}\`) · ${guild.memberCount ?? "?"} members · owner \`${guild.ownerId ?? "?"}\` · now in **${total}** servers`,
      allowedMentions: { parse: [] }
    });
  }

  private async logError(scope: string, error: unknown): Promise<void> {
    const channel = this.channel("bot-errors");
    if (!channel) return;
    const text = truncate(String((error as Error)?.stack ?? (error as Error)?.message ?? error), 1500);
    // At most 5 per 10 minutes, and never the same error twice in a row.
    const now = Date.now();
    this.errorTimes = this.errorTimes.filter((t) => now - t < 10 * 60 * 1000);
    if (this.errorTimes.length >= 5 || text === this.lastErrorText) return;
    this.errorTimes.push(now);
    this.lastErrorText = text;
    await channel.send({ content: `⚠️ **${scope}** <t:${Math.floor(now / 1000)}:T>\n\`\`\`\n${text}\n\`\`\``, allowedMentions: { parse: [] } });
  }

  // -------------------------------------------------------------- help

  private async welcomeHelpPost(thread: ThreadChannel): Promise<void> {
    if (thread.guildId !== SUPPORT_GUILD_ID || !thread.parent || thread.parent.type !== ChannelType.GuildForum) return;
    if (channelKey(thread.parent.name) !== "help") return;
    const faq = this.channel("faq");
    const tags = (thread.parent as ForumChannel).availableTags;
    const solved = tags.find((t) => t.name.toLowerCase() === "solved");
    // Let the starter message land first.
    await new Promise((r) => setTimeout(r, 2500));
    const container = new ContainerBuilder()
      .setAccentColor(ACCENT)
      .addTextDisplayComponents((t) => t.setContent("### 👋 Thanks for posting!"))
      .addTextDisplayComponents((t) =>
        t.setContent(
          [
            "A human will reply soon. To get a faster answer, add:",
            "• the command you ran and what happened (a screenshot helps)",
            "• your **server ID** (Server Settings → Widget, or right-click the server → Copy Server ID)",
            "• roughly when it happened",
            "",
            `${faq ? `Many problems are already answered in <#${faq.id}>. ` : ""}When it's fixed, add the ${solved ? "**✅ Solved**" : "Solved"} tag so others can find the answer.`
          ].join("\n")
        )
      );
    await thread.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } } as any);
  }

  // ----------------------------------------------------------- tickets

  private async handleTicket(interaction: ComponentInteraction, args: string[]): Promise<void> {
    if (interaction.guildId !== SUPPORT_GUILD_ID) return;
    if (args[0] === "open" && isStringSelect(interaction)) return this.openTicket(interaction, interaction.values[0] as TicketTopic);
    if (args[0] === "close" && isButton(interaction)) return this.closeTicket(interaction);
  }

  /** One private thread per member and topic-agnostic: a second click points to the open one. */
  private async openTicket(interaction: ComponentInteraction, topicKey: TicketTopic): Promise<void> {
    const topic = TICKET_TOPICS[topicKey] ?? TICKET_TOPICS.other;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.editReply("Tickets can only be opened from the tickets channel.");
      return;
    }
    const user = interaction.user;
    const suffix = ` · ${user.username}`;
    const active = await (channel as TextChannel).threads.fetchActive();
    const open = active.threads.find((t) => t.parentId === channel.id && t.type === ChannelType.PrivateThread && t.name.endsWith(suffix));
    if (open) {
      await interaction.editReply(`You already have an open ticket: <#${open.id}>`);
      return;
    }

    const thread = await (channel as TextChannel).threads.create({
      name: truncate(`${topic.emoji} ${topic.label.toLowerCase()}${suffix}`, 100),
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      reason: `Ticket opened by ${user.tag} (${user.id})`
    });
    await thread.members.add(user.id);
    const owner = interaction.guild?.ownerId;
    if (owner && owner !== user.id) await thread.members.add(owner).catch(() => undefined);

    const staff = ["Support", "Moderators"].map((n) => this.role(n)).filter(Boolean);
    const container = new ContainerBuilder()
      .setAccentColor(ACCENT)
      .addTextDisplayComponents((t) => t.setContent(`## ${topic.emoji} ${topic.label}`))
      .addTextDisplayComponents((t) =>
        t.setContent(
          [
            `Hi <@${user.id}>, thanks for reaching out. Only you and staff can see this thread.`,
            "",
            `**To help us answer fast:** ${topic.hint}`,
            "",
            "-# Staff will never ask for your password or token. Press Close when you're done."
          ].join("\n")
        )
      )
      .addActionRowComponents((row) =>
        row.setComponents(new ButtonBuilder().setCustomId("ticket:close").setStyle(ButtonStyle.Secondary).setEmoji("🔒").setLabel("Close ticket"))
      );
    await thread.send({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { users: [user.id] } } as any);
    // A role mention adds that role's members to the private thread.
    if (staff.length) {
      await thread.send({ content: `-# ${staff.map((r) => `<@&${r!.id}>`).join(" ")}`, allowedMentions: { roles: staff.map((r) => r!.id) } }).catch(() => undefined);
    }
    await interaction.editReply(`Your ticket is open: <#${thread.id}>`);
    console.log(`[Support] Ticket opened (${topicKey}) by ${user.id}`);
  }

  /** The member who opened the ticket or anyone who can manage threads may close it. */
  private async closeTicket(interaction: ComponentInteraction): Promise<void> {
    const thread = interaction.channel ?? (interaction.channelId ? await this.client!.channels.fetch(interaction.channelId).catch(() => null) : null);
    if (!thread?.isThread() || thread.type !== ChannelType.PrivateThread) {
      await interaction.reply({ content: "This button only works inside a ticket.", flags: MessageFlags.Ephemeral });
      return;
    }
    const isOpener = thread.name.endsWith(` · ${interaction.user.username}`);
    const isStaff = interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads) ?? false;
    if (!isOpener && !isStaff) {
      await interaction.reply({ content: "Only the member who opened this ticket or staff can close it.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ content: `🔒 Closed by <@${interaction.user.id}>. Need more help? Open a new ticket.`, allowedMentions: { parse: [] } });
    // Locked: only staff can reopen it; the thread stays as a record.
    await thread.edit({ locked: true, archived: true, reason: `Ticket closed by ${interaction.user.tag}` }).catch(() => undefined);
  }
}
