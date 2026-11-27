import {
  ActivityType,
  ApplicationIntegrationType,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  Collection,
  ContextMenuCommandInteraction,
  Events,
  GuildMember,
  Interaction,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  Snowflake,
  ActionRowBuilder
} from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { Command, ContextMenuCommand } from "../interfaces/Command";
import { DashboardSyncService } from "../services/dashboardSync";
import { DatabaseService } from "../services/database";
import { DebugPanel } from "../services/debugPanel";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { isGuessGameRunning } from "../services/guessGame";
import { logBuffer } from "../services/logBuffer";
import { PatreonService } from "../services/patreon";
import { syncGuildPresence, TelemetryService } from "../services/telemetry";
import { commandEvent, errorEvent, guildEvent } from "../services/telemetry/events";
import { ttsService } from "../services/tts";
import { fleetMember } from "../shared/fleet";
import { botInviteUrl } from "../shared/links";
import {
  addInstanceGuild,
  isRedisAvailable,
  publishGuildEvent,
  removeBotFromGuild,
  removeInstanceGuild,
  setBotInGuild
} from "../shared/services/redis";
import { checkPermissions, PermissionResult } from "../utils/checkPermissions";
import { config } from "../utils/config";
import { localeForInteraction } from "../utils/guildLocale";
import { i18n, localizeCommandJson, runWithLocale } from "../utils/i18n";
import { INSTANCE, INSTANCE_NAME, isPrimary } from "../utils/instance";
import { MissingPermissionsException } from "../utils/MissingPermissionsException";
import { commands as commandRegistry, contextMenus, mention, setCommandId } from "./commandRegistry";
import { getComponentHandler } from "./componentRouter";

const EPHEMERAL = MessageFlags.Ephemeral;

/** Commands that would break (or spoil) a running guess-the-song round. */
const GAME_BLOCKED_COMMANDS = new Set([
  "play", "playnext", "playnow", "play_file", "play_spotify", "search", "radio", "autoplay", "247",
  "skip", "voteskip", "previous", "replay", "seek", "rewind", "jump", "pause", "resume", "loop",
  "volume", "effects", "shuffle", "move", "remove", "clear", "queuemanage", "join", "say", "grab",
  // These end the game; /guess stop does it with the starter-or-manager rule.
  "stop", "leave"
]);

export class Bot {
  public readonly prefix = "/";
  /** Loaded slash commands by name (same object as the shared registry). */
  public readonly slashCommandsMap = commandRegistry;
  public cooldowns = new Collection<string, Collection<Snowflake, number>>();
  private readonly loaded: Promise<void>;

  public constructor(public readonly client: Client) {
    // Install log buffer FIRST so every subsequent console.log is captured
    logBuffer.install();

    // Load command modules before the gateway is ready, so interactions that
    // arrive right after READY (commands stay registered across restarts)
    // find their handler.
    this.loaded = this.loadModules().catch((error) => {
      console.error("[Bot] ❌ Failed to load commands:", error);
    });

    this.client.login(config.TOKEN).catch((error) => {
      console.error("[Bot] ❌ Discord login failed:", error);
      process.exit(1);
    });

    // A revoked token can leave an already-running gateway client disconnected
    // without terminating the Node process. Validate it periodically so Docker
    // can restart the service and report the failure instead of looking healthy.
    const tokenWatchdog = setInterval(async () => {
      try {
        const response = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bot ${config.TOKEN}` }
        });

        if (response.status === 401 || response.status === 403) {
          console.error(`[Bot] ❌ Discord token rejected (${response.status}); terminating stale session`);
          process.exit(1);
        }
      } catch (error) {
        // A transient DNS/network failure must not restart an otherwise healthy bot.
        console.warn("[Bot] ⚠️ Discord token watchdog could not reach the API:", error);
      }
    }, 5 * 60 * 1000);
    tokenWatchdog.unref();

    this.client.once(Events.ClientReady, () => void this.onReady());

    this.client.on("warn", (info) => console.log(info));
    this.client.on("error", console.error);
    this.client.on(Events.ShardError, (error, shardId) => {
      console.error(`[Bot] ❌ Discord shard ${shardId} error:`, error);
    });
    this.client.on(Events.ShardReconnecting, (shardId) => {
      console.warn(`[Bot] 🔄 Discord shard ${shardId} reconnecting`);
    });
    this.client.on(Events.ShardResume, (shardId, replayedEvents) => {
      console.log(`[Bot] ✅ Discord shard ${shardId} resumed (${replayedEvents} replayed events)`);
      this.setPresence();
    });
    this.client.on(Events.ShardDisconnect, (event, shardId) => {
      console.warn(`[Bot] ⚠️ Discord shard ${shardId} disconnected (code ${event.code})`);
      void TelemetryService.getInstance().markOffline(`Discord gateway closed with code ${event.code}`);

      // 4004 is an authentication failure and cannot recover without a valid token.
      if (event.code === 4004) {
        console.error("[Bot] ❌ Discord authentication failed; terminating stale session");
        process.exit(1);
      }
    });
    this.client.on(Events.Invalidated, () => {
      console.error("[Bot] ❌ Discord session invalidated; restarting cleanly");
      void TelemetryService.getInstance()
        .markOffline("Discord session invalidated")
        .finally(() => process.exit(1));
    });

    // Guild join/leave events for Redis sync
    this.client.on(Events.GuildCreate, async (guild) => {
      console.log(`[Bot] Joined guild: ${guild.name} (${guild.id})`);
      try {
        // Guild metadata is the primary's; every instance tracks its own presence.
        if (isPrimary) {
          await setBotInGuild(guild.id, {
            name: guild.name,
            icon: guild.icon,
            memberCount: guild.memberCount,
            joined: Date.now(),
          });
        }
        await addInstanceGuild(INSTANCE, guild.id);
        await publishGuildEvent(guild.id, { type: "fleet", instance: INSTANCE, online: true, inGuild: true });
      } catch (error) {
        console.error("[Redis] Failed to add guild:", error);
      }
      // Secondaries: no welcome card, join telemetry or listing update.
      if (!isPrimary) return;
      TelemetryService.getInstance().record(
        guildEvent({ guildId: guild.id, event: "join", name: guild.name, memberCount: guild.memberCount })
      );
      const { sendWelcome } = await import("../services/welcome");
      await sendWelcome(guild);
      await this.notifyListsSoon();
    });

    this.client.on(Events.GuildDelete, async (guild) => {
      console.log(`[Bot] Left guild: ${guild.name} (${guild.id})`);
      try {
        if (isPrimary) await removeBotFromGuild(guild.id);
        await removeInstanceGuild(INSTANCE, guild.id);
        await publishGuildEvent(guild.id, { type: "fleet", instance: INSTANCE, online: true, inGuild: false });
      } catch (error) {
        console.error("[Redis] Failed to remove guild:", error);
      }
      if (!isPrimary) return;
      TelemetryService.getInstance().record(
        guildEvent({ guildId: guild.id, event: "leave", name: guild.name, memberCount: guild.memberCount })
      );
      await this.notifyListsSoon();
    });

    this.client.on(Events.InteractionCreate, (interaction) => void this.handleInteraction(interaction));
  }

  // ------------------------------------------------------------------ startup

  private async onReady(): Promise<void> {
    console.log(`${this.client.user!.username} ready!${isPrimary ? "" : ` (fleet instance ${INSTANCE}: ${INSTANCE_NAME})`}`);
    if (!isPrimary) this.checkInstanceToken();
    this.setPresence();
    setInterval(() => this.setPresence(), 30 * 60 * 1000).unref();

    // Initialize Redis and sync guilds with detailed data
    try {
      if (await isRedisAvailable()) {
        await syncGuildPresence(this.client);
        console.log("✅ Redis sync completed");
        void this.publishFleetPresence();

        // Periodic guild refresh (every 3 minutes to prevent key expiration).
        // The online status itself is the TelemetryService heartbeat.
        setInterval(async () => {
          try {
            await syncGuildPresence(this.client);
          } catch (error) {
            console.error("[Redis] Periodic guild sync failed:", error);
          }
        }, 3 * 60 * 1000);
      } else {
        console.log("⚠️ Redis not available, skipping guild sync");
      }
    } catch (error) {
      console.error("⚠️ Redis initialization skipped:", error);
    }

    // Initialize database connection
    try {
      const dbService = DatabaseService.getInstance();
      await dbService.connect(config.MONGODB_URI || "");
      if (dbService.isReady()) {
        console.log("✅ Database service initialized");
        const migrated = isPrimary ? await GuildSettingsService.getInstance().migrateUnusedLanguage() : 0;
        if (migrated) console.log(`✅ ${migrated} servers now follow each member's Discord language`);
      } else {
        console.log("⚠️ Database service initialized but not ready - commands may fail initially");
      }
    } catch (error) {
      console.error("⚠️ Database initialization skipped:", error);
    }

    // Initialize the discord-player service, then the player panel and 24/7
    try {
      const playerService = DiscordPlayerService.getInstance();
      await playerService.initialize(this.client);
      console.log("✅ Discord Player service initialized");

      const { PlayerPanelService } = await import("../services/playerPanel");
      PlayerPanelService.getInstance().attach();

      const { warmYouTubeSearch } = await import("../services/youtubeSearch");
      warmYouTubeSearch();

      const { Stay247Service } = await import("../services/stay247");
      void Stay247Service.getInstance().start(this.client);
    } catch (error) {
      console.error("❌ Failed to initialize Discord Player service:", error);
    }

    // Heartbeat + event telemetry (powers the owner admin console)
    try {
      TelemetryService.getInstance().start(this.client);
    } catch (error) {
      console.error("⚠️ Telemetry failed to start:", error);
    }

    // Initialize Dashboard Sync service (for web dashboard communication)
    try {
      const dashboardSync = DashboardSyncService.getInstance();
      await dashboardSync.initialize(this.client);
      console.log("✅ Dashboard Sync service initialized");
    } catch (error) {
      console.error("⚠️ Dashboard Sync initialization skipped:", error);
    }

    if (!isPrimary) {
      // Secondaries play music and run their own player cards; slash commands,
      // linked bots, Patreon, metrics, listings and the support server are the
      // primary's.
      try {
        DebugPanel.getInstance().start(this.client);
      } catch (error) {
        console.error("⚠️ Debug panel failed to start:", error);
      }
      console.log(`[Bot] ✅ ${INSTANCE_NAME} ready as fleet instance ${INSTANCE} (no slash commands)`);
      return;
    }

    // Initialize Bot Manager service (for linked user bots)
    try {
      const { BotManagerService } = await import("../services/botManager");
      const botManager = BotManagerService.getInstance();
      await botManager.initialize();
      console.log("✅ Bot Manager service initialized");
    } catch (error) {
      console.error("⚠️ Bot Manager initialization skipped:", error);
    }

    // Initialize Patreon service and sync patrons
    try {
      const patreonService = PatreonService.getInstance();
      if (patreonService.isConfigured()) {
        const syncedCount = await patreonService.syncAllPatrons();
        console.log(`✅ Patreon service initialized (${syncedCount} patrons synced)`);

        // Set up periodic sync (every 30 minutes)
        setInterval(async () => {
          try {
            await patreonService.syncAllPatrons();
          } catch (error) {
            console.error("[Patreon] Periodic sync failed:", error);
          }
        }, 30 * 60 * 1000);

        // Note: Patreon webhooks are handled by the Next.js dashboard at /api/webhooks/patreon
        console.log("✅ Patreon webhooks are handled by the dashboard at /api/webhooks/patreon");
      } else {
        console.log("⚠️ Patreon integration not configured (missing CAMPAIGN_ID or ACCESS_TOKEN)");
      }
    } catch (error) {
      console.error("⚠️ Patreon initialization failed:", error);
    }

    // Initialize TTS service (for /say command)
    try {
      ttsService.initialize();
    } catch (error) {
      console.error("⚠️ TTS service initialization failed:", error);
    }

    // Start daily metrics snapshots (powers the dashboard growth analytics)
    try {
      const { MetricsSnapshotService } = await import("../services/metricsSnapshot");
      MetricsSnapshotService.getInstance().start(this.client);
      console.log("✅ Metrics snapshot service started");
    } catch (error) {
      console.error("⚠️ Metrics snapshot service failed to start:", error);
    }

    // Server counts and command lists for bot listing sites (top.gg, …)
    try {
      const { BotListService } = await import("../services/botLists");
      BotListService.getInstance().start(this.client);
    } catch (error) {
      console.error("⚠️ Bot list service failed to start:", error);
    }

    // Status, changelog, votes, roles and logs in the official support server
    try {
      const { SupportServerService } = await import("../services/supportServer");
      SupportServerService.getInstance().start(this.client);
    } catch (error) {
      console.error("⚠️ Support server link failed to start:", error);
    }

    // Start debug panel (requires DEBUG_TOKEN env var)
    try {
      DebugPanel.getInstance().start(this.client);
    } catch (error) {
      console.error("⚠️ Debug panel failed to start:", error);
    }

    console.log("\n=================================================");
    console.log("Bot Invite Link:");
    console.log(botInviteUrl(this.client.user!.id));
    console.log("=================================================\n");

    this.registerSlashCommands().catch((error) => {
      console.error("[Bot] ❌ Failed to register slash commands:", error);
    });
  }

  /**
   * A secondary started with the primary's token would answer every slash
   * command twice; refuse to run. A token for a different application than
   * FLEET_APPLICATION_IDS lists only warns (invite links would be wrong).
   */
  private checkInstanceToken(): void {
    const me = this.client.user!.id;
    if (me === fleetMember(1)?.applicationId) {
      console.error(`[Bot] ❌ BOT_INSTANCE=${INSTANCE} is running with the primary's token; set TOKEN_${INSTANCE} to the ${INSTANCE_NAME} token`);
      process.exit(1);
    }
    const expected = fleetMember(INSTANCE)?.applicationId;
    if (expected && expected !== me) {
      console.warn(`[Bot] ⚠️ FLEET_APPLICATION_IDS lists ${expected} for instance ${INSTANCE}, but this token is application ${me}`);
    }
  }

  /** Tell live dashboards this instance is up in each of its servers. */
  private async publishFleetPresence(online = true): Promise<void> {
    for (const guild of this.client.guilds.cache.values()) {
      await publishGuildEvent(guild.id, { type: "fleet", instance: INSTANCE, online, inGuild: true }).catch(() => undefined);
    }
  }

  private setPresence(): void {
    try {
      this.client.user?.setPresence({
        status: "online",
        activities: [{ name: "custom", type: ActivityType.Custom, state: "🎶 /play · /help · music-bot.checkleaked.com" }]
      });
    } catch (error) {
      console.warn("[Bot] Could not set presence:", error);
    }
  }

  private listTimer: NodeJS.Timeout | null = null;
  /** Debounced server-count update for listing sites after joins/leaves. */
  private async notifyListsSoon(): Promise<void> {
    if (this.listTimer) return;
    this.listTimer = setTimeout(async () => {
      this.listTimer = null;
      try {
        const { BotListService } = await import("../services/botLists");
        await BotListService.getInstance().postStats(this.client);
      } catch (error) {
        console.warn("[Bot] Listing stats update failed:", error);
      }
    }, 60_000);
    this.listTimer.unref();
  }

  private async loadModules(): Promise<void> {
    const isModule = (file: string) =>
      (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts") && !file.endsWith(".map");

    const commandsPath = join(__dirname, "..", "commands");
    for (const file of readdirSync(commandsPath).filter(isModule)) {
      const mod = await import(join(commandsPath, file));
      const command: Command | undefined = mod.default;
      if (command?.data) commandRegistry.set(command.data.name, command);
    }

    const contextPath = join(__dirname, "..", "contextMenus");
    try {
      for (const file of readdirSync(contextPath).filter(isModule)) {
        const mod = await import(join(contextPath, file));
        const menu: ContextMenuCommand | undefined = mod.default;
        if (menu?.data) contextMenus.set(menu.data.name, menu);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    // Persistent component handlers register themselves on import.
    await import("../services/helpMenu");
    await import("../services/queueView");
    await import("../services/playerPanel").then((m) => m.PlayerPanelService.getInstance());
    console.log(`[Bot] Loaded ${commandRegistry.size} commands and ${contextMenus.size} context menus`);
  }

  /** Every command as Discord JSON, with install contexts and localized descriptions. */
  public buildCommandPayload(): any[] {
    const guildOnly = {
      contexts: [InteractionContextType.Guild],
      integration_types: [ApplicationIntegrationType.GuildInstall]
    };
    const everywhere = {
      contexts: [InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel],
      integration_types: [ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall]
    };

    const slash = [...commandRegistry.values()].filter((command) => command.isAvailable?.() ?? true).map((command) => {
      const json = command.data.toJSON() as any;
      Object.assign(json, command.userInstallable ? everywhere : guildOnly);
      return localizeCommandJson(json);
    });
    const menus = [...contextMenus.values()].map((menu) => {
      const json = menu.data.toJSON() as any;
      Object.assign(json, menu.userInstallable ? everywhere : guildOnly);
      return json;
    });
    if (slash.length > 100) {
      console.error(`[Bot] ❌ ${slash.length} slash commands exceed Discord's limit of 100; extra ones are dropped`);
    }
    return [...slash.slice(0, 100), ...menus];
  }

  private async registerSlashCommands() {
    await this.loaded;
    const rest = new REST({ version: "10" }).setToken(config.TOKEN);
    const body = this.buildCommandPayload();
    const registered = (await rest.put(Routes.applicationCommands(this.client.user!.id), { body })) as {
      id: string;
      name: string;
    }[];
    for (const command of registered) setCommandId(command.name, command.id);
    console.log(`[Bot] ✅ Registered ${registered.length} application commands`);
  }

  // ------------------------------------------------------------ interactions

  private async handleInteraction(interaction: Interaction): Promise<void> {
    await this.loaded;
    let locale;
    try {
      locale = await localeForInteraction(interaction);
    } catch {
      locale = undefined;
    }

    const run = async () => {
      if (interaction.isChatInputCommand()) return this.handleChatInput(interaction);
      if (interaction.isAutocomplete()) return this.handleAutocomplete(interaction);
      if (interaction.isContextMenuCommand()) return this.handleContextMenu(interaction);
      if (interaction.isMessageComponent() || interaction.isModalSubmit()) return this.handleComponent(interaction);
    };

    try {
      await (locale ? runWithLocale(locale, run) : run());
    } catch (error) {
      console.error("[Bot] Unhandled interaction error:", error);
    }
  }

  private async replyEphemeral(interaction: Interaction | ContextMenuCommandInteraction, content: string, components?: ActionRowBuilder<any>[]) {
    if (!interaction.isRepliable()) return;
    const payload = { content, flags: EPHEMERAL, components: components ?? [] } as const;
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
      else await interaction.reply(payload);
    } catch (error) {
      console.error("[Bot] Could not send reply:", (error as Error)?.message ?? error);
    }
  }

  /** Blacklist, allowed channels and disabled commands. Returns an error message or null. */
  private async guildGate(interaction: ChatInputCommandInteraction | ContextMenuCommandInteraction, name: string): Promise<string | null> {
    if (!interaction.inCachedGuild()) return null;
    const settingsService = GuildSettingsService.getInstance();
    const settings = await settingsService.getSettings(interaction.guildId);

    if (settings.blacklistedUsers?.includes(interaction.user.id)) return `❌ ${i18n.__("router.blacklisted")}`;

    const member = interaction.member as GuildMember;
    const isManager = member.permissions.has(PermissionFlagsBits.ManageGuild);

    if (!isManager && interaction.channelId && settings.allowedTextChannels?.length) {
      // Threads inherit their parent's permission.
      const channel = interaction.channel;
      const parentId = channel && "parentId" in channel && channel.isThread() ? channel.parentId : null;
      const allowed = settings.allowedTextChannels.includes(interaction.channelId) || (parentId && settings.allowedTextChannels.includes(parentId));
      if (!allowed) return `❌ ${i18n.__("router.channelNotAllowed")}`;
    }

    if (!isManager && settings.disabledCommands?.includes(name)) {
      return `🚫 ${i18n.__mf("router.commandDisabled", { name })}`;
    }

    // A guess-the-song round owns the player: skipping, seeking or queueing
    // music mid-round would break it (or reveal the answer).
    if ((interaction.isContextMenuCommand() || GAME_BLOCKED_COMMANDS.has(name)) && isGuessGameRunning(interaction.guildId)) {
      return `🎯 ${i18n.__mf("guess.blockedDuringGame", { stop: mention("guess", "stop") })}`;
    }
    return null;
  }

  private checkCooldown(name: string, userId: string, seconds: number): number {
    if (!this.cooldowns.has(name)) this.cooldowns.set(name, new Collection());
    const timestamps = this.cooldowns.get(name)!;
    const now = Date.now();
    const cooldownAmount = seconds * 1000;
    const timestamp = timestamps.get(userId);
    if (timestamp && now < timestamp + cooldownAmount) return (timestamp + cooldownAmount - now) / 1000;
    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount).unref();
    return 0;
  }

  private async handleChatInput(interaction: ChatInputCommandInteraction): Promise<unknown> {
    const command = commandRegistry.get(interaction.commandName);
    if (!command) return this.replyEphemeral(interaction, `⚠️ ${i18n.__("router.expired")}`);

    // A guild command used where the bot user isn't a member (user-installed,
    // or invited without the bot scope): offer to add it there.
    if (!command.userInstallable && !interaction.inCachedGuild()) {
      const invite = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setURL(botInviteUrl(this.client.user!.id, interaction.guildId ?? undefined))
          .setLabel(i18n.__("links.addToServer"))
          .setEmoji("➕")
          .setStyle(ButtonStyle.Link)
      );
      return this.replyEphemeral(interaction, `🎵 ${i18n.__("router.guildOnly")}`, [invite]);
    }

    const blocked = await this.guildGate(interaction, interaction.commandName);
    if (blocked) return this.replyEphemeral(interaction, blocked);

    const wait = this.checkCooldown(interaction.commandName, interaction.user.id, command.cooldown || 1);
    if (wait > 0) {
      return this.replyEphemeral(interaction, `⏳ ${i18n.__mf("router.cooldown", { name: interaction.commandName, time: wait.toFixed(1) })}`);
    }

    const telemetry = TelemetryService.getInstance();
    const startedAt = Date.now();
    const subcommand = interaction.options.getSubcommand(false);
    const guildIdForEvent = interaction.guildId ?? "dm";

    try {
      if (interaction.inCachedGuild()) {
        const permissionsCheck: PermissionResult = await checkPermissions(command, interaction);
        if (!permissionsCheck.result) throw new MissingPermissionsException(permissionsCheck.missing);
      }

      await command.execute(interaction);

      telemetry.record(
        commandEvent({
          guildId: guildIdForEvent,
          userId: interaction.user.id,
          command: interaction.commandName,
          subcommand,
          ok: true,
          durationMs: Date.now() - startedAt
        })
      );
    } catch (error: any) {
      console.error(error);

      telemetry.record(
        commandEvent({
          guildId: guildIdForEvent,
          userId: interaction.user.id,
          command: interaction.commandName,
          subcommand,
          ok: false,
          durationMs: Date.now() - startedAt,
          error
        })
      );

      if (error instanceof MissingPermissionsException) {
        return this.replyEphemeral(
          interaction,
          `🔒 ${i18n.__mf("router.missingPermissions", { permissions: error.permissions.join(", ") })}`
        );
      }

      telemetry.noteError("command", error);
      telemetry.record(errorEvent({ scope: "command", error, guildId: guildIdForEvent, command: interaction.commandName }));
      return this.replyEphemeral(interaction, `⚠️ ${i18n.__("router.error")}`);
    }
  }

  private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const command = commandRegistry.get(interaction.commandName);
    try {
      if (command?.autocomplete) await command.autocomplete(interaction);
      else await interaction.respond([]);
    } catch (error) {
      console.warn(`[Bot] Autocomplete for /${interaction.commandName} failed:`, (error as Error)?.message ?? error);
      if (!interaction.responded) await interaction.respond([]).catch(() => undefined);
    }
  }

  private async handleContextMenu(interaction: ContextMenuCommandInteraction): Promise<unknown> {
    const menu = contextMenus.get(interaction.commandName);
    if (!menu) return this.replyEphemeral(interaction, `⚠️ ${i18n.__("router.expired")}`);

    const blocked = await this.guildGate(interaction, interaction.commandName);
    if (blocked) return this.replyEphemeral(interaction, blocked);

    const wait = this.checkCooldown(interaction.commandName, interaction.user.id, menu.cooldown || 2);
    if (wait > 0) {
      return this.replyEphemeral(interaction, `⏳ ${i18n.__mf("router.cooldown", { name: interaction.commandName, time: wait.toFixed(1) })}`);
    }

    try {
      await menu.execute(interaction as any);
    } catch (error) {
      console.error(`[Bot] Context menu "${interaction.commandName}" failed:`, error);
      TelemetryService.getInstance().noteError("command", error);
      return this.replyEphemeral(interaction, `⚠️ ${i18n.__("router.error")}`);
    }
  }

  private async handleComponent(interaction: Interaction): Promise<unknown> {
    if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;
    const found = getComponentHandler(interaction.customId);
    // Not ours: a command's own collector is handling it.
    if (!found) return;

    if (interaction.inCachedGuild()) {
      const settings = await GuildSettingsService.getInstance().getSettings(interaction.guildId);
      if (settings.blacklistedUsers?.includes(interaction.user.id)) {
        return this.replyEphemeral(interaction, `❌ ${i18n.__("router.blacklisted")}`);
      }
    }

    try {
      await found.handler(interaction, found.args);
    } catch (error) {
      console.error(`[Bot] Component "${interaction.customId}" failed:`, error);
      TelemetryService.getInstance().noteError("command", error);
      return this.replyEphemeral(interaction, `⚠️ ${i18n.__("router.error")}`);
    }
  }
}
