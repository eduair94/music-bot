import {
  ChatInputCommandInteraction,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import { GuildSettingsService } from "../services/guildSettings";
import {
  handleView,
  handleDJRole,
  handleAdminRole,
  handleVolume,
  handleQueue,
  handleBehavior,
  handleVoiceChannels,
  handleTextChannels,
  handleLogChannel,
  handleBlacklist,
  handleLanguage,
  handleEmbedColor,
  handleReset,
  handleStats,
  SettingsHandlerContext,
} from "./settings/index";

export default {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Configure bot settings for this server (Admin only)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("view").setDescription("View current settings")
    )
    .addSubcommand((sub) =>
      sub.setName("djrole").setDescription("Set the DJ role for music control")
    )
    .addSubcommand((sub) =>
      sub.setName("adminrole").setDescription("Set the admin role for settings management")
    )
    .addSubcommand((sub) =>
      sub
        .setName("volume")
        .setDescription("Set default and maximum volume")
        .addIntegerOption((opt) =>
          opt
            .setName("default")
            .setDescription("Default volume (0-100)")
            .setMinValue(0)
            .setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("max")
            .setDescription("Maximum allowed volume (0-100)")
            .setMinValue(0)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("queue")
        .setDescription("Configure queue settings")
        .addIntegerOption((opt) =>
          opt
            .setName("maxsize")
            .setDescription("Maximum queue size (1-1000)")
            .setMinValue(1)
            .setMaxValue(1000)
        )
        .addBooleanOption((opt) =>
          opt
            .setName("preventduplicates")
            .setDescription("Prevent duplicate songs in queue")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("behavior")
        .setDescription("Configure bot behavior")
        .addBooleanOption((opt) =>
          opt
            .setName("announcements")
            .setDescription("Announce now playing in text channel")
        )
        .addBooleanOption((opt) =>
          opt
            .setName("autoleave")
            .setDescription("Leave voice channel when empty")
        )
        .addIntegerOption((opt) =>
          opt
            .setName("leavetimeout")
            .setDescription("Seconds before leaving empty channel (30-3600)")
            .setMinValue(30)
            .setMaxValue(3600)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("voicechannels").setDescription("Set allowed voice channels")
    )
    .addSubcommand((sub) =>
      sub.setName("textchannels").setDescription("Set allowed text channels for commands")
    )
    .addSubcommand((sub) =>
      sub.setName("logchannel").setDescription("Set the channel for bot logs (now playing, etc.)")
    )
    .addSubcommand((sub) =>
      sub
        .setName("blacklist")
        .setDescription("Manage user blacklist")
        .addUserOption((opt) =>
          opt.setName("add").setDescription("Add user to blacklist")
        )
        .addUserOption((opt) =>
          opt.setName("remove").setDescription("Remove user from blacklist")
        )
    )
    .addSubcommand((sub) =>
      sub.setName("language").setDescription("Set bot language for this server")
    )
    .addSubcommand((sub) =>
      sub
        .setName("embedcolor")
        .setDescription("Set custom embed color")
        .addStringOption((opt) =>
          opt
            .setName("color")
            .setDescription("Hex color code (e.g., #FF5500)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("reset").setDescription("Reset all settings to default")
    )
    .addSubcommand((sub) =>
      sub.setName("stats").setDescription("View server music statistics")
    ),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guild!.id;
    const settingsService = GuildSettingsService.getInstance();
    const subcommand = interaction.options.getSubcommand();

    // Check if user has permission to manage settings
    const member = interaction.guild!.members.cache.get(interaction.user.id);
    const isServerAdmin = member?.permissions.has(PermissionsBitField.Flags.ManageGuild) || false;
    const userRoles = member?.roles.cache.map((r) => r.id) || [];
    
    const canManage = await settingsService.canManageSettings(guildId, userRoles, isServerAdmin);
    if (!canManage) {
      return interaction.reply({
        content: "You don't have permission to manage bot settings.",
        ephemeral: true,
      });
    }

    const settings = await settingsService.getSettings(guildId);

    // Create handler context
    const ctx: SettingsHandlerContext = {
      interaction,
      guildId,
      settings,
      settingsService,
    };

    // Route to appropriate handler
    const handlers: Record<string, (ctx: SettingsHandlerContext) => Promise<unknown>> = {
      view: handleView,
      djrole: handleDJRole,
      adminrole: handleAdminRole,
      volume: handleVolume,
      queue: handleQueue,
      behavior: handleBehavior,
      voicechannels: handleVoiceChannels,
      textchannels: handleTextChannels,
      logchannel: handleLogChannel,
      blacklist: handleBlacklist,
      language: handleLanguage,
      embedcolor: handleEmbedColor,
      reset: handleReset,
      stats: handleStats,
    };

    const handler = handlers[subcommand];
    if (handler) {
      return handler(ctx);
    }

    return interaction.reply({
      content: "Unknown subcommand.",
      ephemeral: true,
    });
  },
};
