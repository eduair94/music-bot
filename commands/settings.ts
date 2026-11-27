import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import { GuildSettingsService } from "../services/guildSettings";
import { descriptionLocalizations, i18n } from "../utils/i18n";
import {
  handleAdminRole,
  handleBehavior,
  handleBlacklist,
  handleDJRole,
  handleEmbedColor,
  handleLanguage,
  handleLogChannel,
  handleQueue,
  handleReset,
  handleStats,
  handleTextChannels,
  handleView,
  handleVoiceChannels,
  handleVolume,
  SettingsHandlerContext,
  settingsVerdict,
} from "./settings/index";
import { denialMessage } from "../utils/permissions";

/** Description plus its translations, read from the locale files at load. */
function described<T extends { setDescription(text: string): T; setDescriptionLocalizations(map: Record<string, string> | null): T }>(
  builder: T,
  key: string
): T {
  return builder.setDescription(i18n.__(key)).setDescriptionLocalizations(descriptionLocalizations(key) ?? null);
}

export default {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription(i18n.__("settings.description"))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand((sub) => described(sub.setName("view"), "settings.view.description"))
    .addSubcommand((sub) => described(sub.setName("djrole"), "settings.djrole.description"))
    .addSubcommand((sub) => described(sub.setName("adminrole"), "settings.adminrole.description"))
    .addSubcommand((sub) =>
      described(sub.setName("volume"), "settings.volume.description")
        .addIntegerOption((opt) =>
          described(opt.setName("default"), "settings.volume.optionDefault").setMinValue(0).setMaxValue(100)
        )
        .addIntegerOption((opt) =>
          described(opt.setName("max"), "settings.volume.optionMax").setMinValue(0).setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      described(sub.setName("queue"), "settings.queue.description")
        .addIntegerOption((opt) =>
          described(opt.setName("maxsize"), "settings.queue.optionMaxSize").setMinValue(1).setMaxValue(1000)
        )
        .addBooleanOption((opt) => described(opt.setName("preventduplicates"), "settings.queue.optionPreventDuplicates"))
    )
    .addSubcommand((sub) =>
      described(sub.setName("behavior"), "settings.behavior.description")
        .addBooleanOption((opt) => described(opt.setName("announcements"), "settings.behavior.optionAnnouncements"))
        .addBooleanOption((opt) => described(opt.setName("autoleave"), "settings.behavior.optionAutoLeave"))
        .addIntegerOption((opt) =>
          described(opt.setName("leavetimeout"), "settings.behavior.optionLeaveTimeout").setMinValue(30).setMaxValue(3600)
        )
    )
    .addSubcommand((sub) => described(sub.setName("voicechannels"), "settings.voicechannels.description"))
    .addSubcommand((sub) => described(sub.setName("textchannels"), "settings.textchannels.description"))
    .addSubcommand((sub) => described(sub.setName("logchannel"), "settings.logchannel.description"))
    .addSubcommand((sub) =>
      described(sub.setName("blacklist"), "settings.blacklist.description")
        .addUserOption((opt) => described(opt.setName("add"), "settings.blacklist.optionAdd"))
        .addUserOption((opt) => described(opt.setName("remove"), "settings.blacklist.optionRemove"))
    )
    .addSubcommand((sub) => described(sub.setName("language"), "settings.language.description"))
    .addSubcommand((sub) =>
      described(sub.setName("embedcolor"), "settings.embedcolor.description").addStringOption((opt) =>
        described(opt.setName("color"), "settings.embedcolor.optionColor").setRequired(true)
      )
    )
    .addSubcommand((sub) => described(sub.setName("reset"), "settings.reset.description"))
    .addSubcommand((sub) => described(sub.setName("stats"), "settings.stats.description")),

  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;
    const guildId = interaction.guildId;
    const settingsService = GuildSettingsService.getInstance();
    const subcommand = interaction.options.getSubcommand();

    // The "settings" rule: Manage Server, the admin role, or whoever the rule allows
    const verdict = await settingsVerdict(interaction);
    if (!verdict.ok) {
      return interaction.reply({ content: denialMessage(verdict), flags: MessageFlags.Ephemeral });
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
      content: i18n.__("settings.unknownSubcommand"),
      flags: MessageFlags.Ephemeral,
    });
  },
};
