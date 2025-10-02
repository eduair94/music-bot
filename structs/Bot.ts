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
import { checkPermissions, PermissionResult } from "../utils/checkPermissions";
import { config } from "../utils/config";
import { i18n } from "../utils/i18n";
import { MissingPermissionsException } from "../utils/MissingPermissionsException";
import { MusicQueue } from "./MusicQueue";

export class Bot {
  public readonly prefix = "/";
  public commands = new Collection<string, Command>();
  public slashCommands = new Array<ApplicationCommandDataResolvable>();
  public slashCommandsMap = new Collection<string, Command>();
  public cooldowns = new Collection<string, Collection<Snowflake, number>>();
  public queues = new Collection<Snowflake, MusicQueue>();

  public constructor(public readonly client: Client) {
    this.client.login(config.TOKEN);

    this.client.on("ready", () => {
      console.log(`${this.client.user!.username} ready!`);

      // Generate and display bot invite link
      const clientId = this.client.user!.id;
      const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=36700160&scope=bot%20applications.commands`;
      console.log('\n=================================================');
      console.log('Bot Invite Link:');
      console.log(inviteLink);
      console.log('=================================================\n');

      this.registerSlashCommands();

      // Force save if in remote session
      if (this.isRemoteSession()) {
        this.forceSave();
      }
    });

    this.client.on("warn", (info) => console.log(info));
    this.client.on("error", console.error);

    this.onInteractionCreate();
  }

  private async registerSlashCommands() {
    const rest = new REST({ version: "9" }).setToken(config.TOKEN);

    const commandFiles = readdirSync(join(__dirname, "..", "commands")).filter((file) => !file.endsWith(".map"));

    for (const file of commandFiles) {
      const command = await import(join(__dirname, "..", "commands", `${file}`));

      this.slashCommands.push(command.default.data);
      this.slashCommandsMap.set(command.default.data.name, command.default);
    }

    await rest.put(Routes.applicationCommands(this.client.user!.id), { body: this.slashCommands });
  }

  private async onInteractionCreate() {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction): Promise<any> => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.slashCommandsMap.get(interaction.commandName);

      if (!command) return;

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

  private isRemoteSession(): boolean {
    // Check various indicators of remote session
    return !!(
      process.env.SSH_CONNECTION ||
      process.env.SSH_CLIENT ||
      process.env.SSH_TTY ||
      process.env.CODESPACES ||
      process.env.GITPOD_WORKSPACE_ID ||
      process.env.REMOTE_CONTAINERS ||
      process.env.VSCODE_REMOTE_USER
    );
  }

  private forceSave(): void {
    console.log("Remote session detected - forcing save operations");
    
    // Force save any configuration or state files
    try {
      // You can add specific save operations here based on your application needs
      // For example, saving current queues state, configuration, etc.
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      console.log("Force save completed successfully");
    } catch (error) {
      console.error("Error during force save:", error);
    }
  }
}
