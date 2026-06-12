import {
  ApplicationCommandDataResolvable,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
  Interaction,
  REST,
  Routes,
  Snowflake
} from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { Command } from "../interfaces/Command";
import { DashboardSyncService } from "../services/dashboardSync";
import { DatabaseService } from "../services/database";
import { DebugPanel } from "../services/debugPanel";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { logBuffer } from "../services/logBuffer";
import { PatreonService } from "../services/patreon";
import { ttsService } from "../services/tts";
import {
  GuildData,
  isRedisAvailable,
  removeBotFromGuild,
  setBotInGuild,
  setBotStatus,
  syncBotGuildsWithData
} from "../shared/services/redis";
import { checkPermissions, PermissionResult } from "../utils/checkPermissions";
import { config } from "../utils/config";
import { i18n } from "../utils/i18n";
import { MissingPermissionsException } from "../utils/MissingPermissionsException";
import { safeReply } from "../utils/safeReply";

export class Bot {
  public readonly prefix = "/";
  public commands = new Collection<string, Command>();
  public slashCommands = new Array<ApplicationCommandDataResolvable>();
  public slashCommandsMap = new Collection<string, Command>();
  public cooldowns = new Collection<string, Collection<Snowflake, number>>();

  public constructor(public readonly client: Client) {
    // Install log buffer FIRST so every subsequent console.log is captured
    logBuffer.install();

    this.client.login(config.TOKEN).catch((error) => {
      console.error("[Bot] ❌ Discord login failed:", error);
      process.exit(1);
    });

    this.client.on("ready", async () => {
      console.log(`${this.client.user!.username} ready!`);

      // Initialize Redis and sync guilds with detailed data
      try {
        if (await isRedisAvailable()) {
          const guildsData: GuildData[] = this.client.guilds.cache.map(g => ({
            id: g.id,
            name: g.name,
            icon: g.icon,
            memberCount: g.memberCount,
            ownerId: g.ownerId,
            joinedAt: g.joinedTimestamp || Date.now(),
          }));
          await syncBotGuildsWithData(guildsData);
          await setBotStatus({
            online: true,
            username: this.client.user!.username,
            discriminator: this.client.user!.discriminator,
            avatar: this.client.user!.avatar,
            guildCount: guildsData.length,
            startedAt: new Date().toISOString(),
          });
          console.log("✅ Redis sync completed");
          
          // Set up periodic guild refresh (every 3 minutes to prevent key expiration)
          setInterval(async () => {
            try {
              const currentGuildsData: GuildData[] = this.client.guilds.cache.map(g => ({
                id: g.id,
                name: g.name,
                icon: g.icon,
                memberCount: g.memberCount,
                ownerId: g.ownerId,
                joinedAt: g.joinedTimestamp || Date.now(),
              }));
              await syncBotGuildsWithData(currentGuildsData);
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
        } else {
          console.log("⚠️ Database service initialized but not ready - commands may fail initially");
        }
      } catch (error) {
        console.error("⚠️ Database initialization skipped:", error);
      }

      // Initialize the discord-player service
      try {
        const playerService = DiscordPlayerService.getInstance();
        await playerService.initialize(this.client);
        console.log("✅ Discord Player service initialized");
      } catch (error) {
        console.error("❌ Failed to initialize Discord Player service:", error);
      }

      // Initialize Dashboard Sync service (for web dashboard communication)
      try {
        const dashboardSync = DashboardSyncService.getInstance();
        await dashboardSync.initialize(this.client);
        console.log("✅ Dashboard Sync service initialized");
      } catch (error) {
        console.error("⚠️ Dashboard Sync initialization skipped:", error);
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

          // Note: Patreon webhooks are now handled by the Next.js dashboard
          // Configure your Patreon webhooks to point to: {DASHBOARD_URL}/api/webhooks/patreon
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

      // Start debug panel (requires DEBUG_TOKEN env var)
      try {
        DebugPanel.getInstance().start(this.client);
      } catch (error) {
        console.error("⚠️ Debug panel failed to start:", error);
      }

      // Generate and display bot invite link
      const clientId = this.client.user!.id;
      const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=36700160&scope=bot%20applications.commands`;
      console.log('\n=================================================');
      console.log('Bot Invite Link:');
      console.log(inviteLink);
      console.log('=================================================\n');

      this.registerSlashCommands().catch((error) => {
        console.error("[Bot] ❌ Failed to register slash commands:", error);
      });
    });

    this.client.on("warn", (info) => console.log(info));
    this.client.on("error", console.error);

    // Guild join/leave events for Redis sync
    this.client.on("guildCreate", async (guild) => {
      console.log(`[Bot] Joined guild: ${guild.name} (${guild.id})`);
      try {
        await setBotInGuild(guild.id, {
          name: guild.name,
          icon: guild.icon,
          memberCount: guild.memberCount,
          joined: Date.now(),
        });
      } catch (error) {
        console.error("[Redis] Failed to add guild:", error);
      }
    });

    this.client.on("guildDelete", async (guild) => {
      console.log(`[Bot] Left guild: ${guild.name} (${guild.id})`);
      try {
        await removeBotFromGuild(guild.id);
      } catch (error) {
        console.error("[Redis] Failed to remove guild:", error);
      }
    });

    this.onInteractionCreate();
  }

  private async registerSlashCommands() {
    const rest = new REST({ version: "9" }).setToken(config.TOKEN);

    const commandsPath = join(__dirname, "..", "commands");
    const commandFiles = readdirSync(commandsPath).filter((file) => {
      // Only include .ts or .js files, exclude .map files and directories
      const isValidExtension = file.endsWith(".ts") || file.endsWith(".js");
      const isNotMapFile = !file.endsWith(".map") && !file.endsWith(".d.ts");
      return isValidExtension && isNotMapFile;
    });

    for (const file of commandFiles) {
      const command = await import(join(commandsPath, file));

      if (command.default?.data) {
        this.slashCommands.push(command.default.data);
        this.slashCommandsMap.set(command.default.data.name, command.default);
      }
    }

    await rest.put(Routes.applicationCommands(this.client.user!.id), { body: this.slashCommands });
  }

  private async onInteractionCreate() {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction): Promise<any> => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.slashCommandsMap.get(interaction.commandName);

      if (!command) return;

      // Commands assume a guild context (interaction.guild!.id, voice channels, etc.)
      if (!interaction.guild) {
        return interaction.reply({
          content: "❌ Commands can only be used in a server.",
          ephemeral: true
        }).catch(console.error);
      }

      // Check guild settings for blacklisted users and allowed channels
      const guildId = interaction.guild?.id;
      if (guildId) {
        const settingsService = GuildSettingsService.getInstance();
        const channelId = interaction.channel?.id;
        
        // Run both checks in parallel for faster response
        const [isBlacklisted, isChannelAllowed] = await Promise.all([
          settingsService.isUserBlacklisted(guildId, interaction.user.id),
          channelId ? settingsService.isTextChannelAllowed(guildId, channelId) : Promise.resolve(true)
        ]);

        if (isBlacklisted) {
          return interaction.reply({
            content: "❌ You are not allowed to use this bot.",
            ephemeral: true
          });
        }

        if (!isChannelAllowed) {
          return interaction.reply({
            content: "❌ Bot commands are not allowed in this channel.",
            ephemeral: true
          });
        }
      }

      if (!this.cooldowns.has(interaction.commandName)) {
        this.cooldowns.set(interaction.commandName, new Collection());
      }

      const now = Date.now();
      const timestamps = this.cooldowns.get(interaction.commandName)!;
      const cooldownAmount = (command.cooldown || 1) * 1000;

      const timestamp = timestamps.get(interaction.user.id);

      if (timestamp) {
        const expirationTime = timestamp + cooldownAmount;

        if (now < expirationTime) {
          const timeLeft = (expirationTime - now) / 1000;
          return interaction.reply({
            content: i18n.__mf("common.cooldownMessage", {
              time: timeLeft.toFixed(1),
              name: interaction.commandName
            }),
            ephemeral: true
          });
        }
      }

      timestamps.set(interaction.user.id, now);
      setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

      try {
        const permissionsCheck: PermissionResult = await checkPermissions(command, interaction);

        if (permissionsCheck.result) {
          await command.execute(interaction as ChatInputCommandInteraction);
        } else {
          throw new MissingPermissionsException(permissionsCheck.missing);
        }
      } catch (error: any) {
        console.error(error);

        const message = typeof error?.message === "string" && error.message.includes("permissions")
          ? error.toString()
          : i18n.__("common.errorCommand");

        await safeReply(interaction, { content: message, ephemeral: true });
      }
    });
  }
}
