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
import { DatabaseService } from "../services/database";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { PatreonService } from "../services/patreon";
import { checkPermissions, PermissionResult } from "../utils/checkPermissions";
import { config } from "../utils/config";
import { i18n } from "../utils/i18n";
import { MissingPermissionsException } from "../utils/MissingPermissionsException";

export class Bot {
  public readonly prefix = "/";
  public commands = new Collection<string, Command>();
  public slashCommands = new Array<ApplicationCommandDataResolvable>();
  public slashCommandsMap = new Collection<string, Command>();
  public cooldowns = new Collection<string, Collection<Snowflake, number>>();

  public constructor(public readonly client: Client) {
    this.client.login(config.TOKEN);

    this.client.on("ready", async () => {
      console.log(`${this.client.user!.username} ready!`);

      // Initialize database connection
      try {
        const dbService = DatabaseService.getInstance();
        await dbService.connect(config.MONGODB_URI || "");
        if (dbService.isConnected()) {
          console.log("✅ Database service initialized");
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
        } else {
          console.log("⚠️ Patreon integration not configured");
        }
      } catch (error) {
        console.error("⚠️ Patreon initialization failed:", error);
      }

      // Generate and display bot invite link
      const clientId = this.client.user!.id;
      const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=36700160&scope=bot%20applications.commands`;
      console.log('\n=================================================');
      console.log('Bot Invite Link:');
      console.log(inviteLink);
      console.log('=================================================\n');

      this.registerSlashCommands();
    });

    this.client.on("warn", (info) => console.log(info));
    this.client.on("error", console.error);

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

      // Check guild settings for blacklisted users and allowed channels
      const guildId = interaction.guild?.id;
      if (guildId) {
        const settingsService = GuildSettingsService.getInstance();
        
        // Check if user is blacklisted
        const isBlacklisted = await settingsService.isUserBlacklisted(guildId, interaction.user.id);
        if (isBlacklisted) {
          return interaction.reply({
            content: "❌ You are not allowed to use this bot.",
            ephemeral: true
          });
        }

        // Check if text channel is allowed
        const channelId = interaction.channel?.id;
        if (channelId) {
          const isChannelAllowed = await settingsService.isTextChannelAllowed(guildId, channelId);
          if (!isChannelAllowed) {
            return interaction.reply({
              content: "❌ Bot commands are not allowed in this channel.",
              ephemeral: true
            });
          }
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
          command.execute(interaction as ChatInputCommandInteraction);
        } else {
          throw new MissingPermissionsException(permissionsCheck.missing);
        }
      } catch (error: any) {
        console.error(error);

        if (error.message.includes("permissions")) {
          interaction.reply({ content: error.toString(), ephemeral: true }).catch(console.error);
        } else {
          interaction.reply({ content: i18n.__("common.errorCommand"), ephemeral: true }).catch(console.error);
        }
      }
    });
  }
}
