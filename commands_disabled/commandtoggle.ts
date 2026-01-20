import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import { i18n } from "../utils/i18n";
import { GuildSettingsService } from "../services/guildSettings";

export default {
  data: new SlashCommandBuilder()
    .setName("commandtoggle")
    .setDescription(i18n.__("commandtoggle.description"))
    .addStringOption(option =>
      option
        .setName("command")
        .setDescription("Command to toggle (without /)")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const commandName = interaction.options.getString("command", true).toLowerCase();
    const settingsService = GuildSettingsService.getInstance();
    const settings = await settingsService.getSettings(guildId);

    // Protected commands that can't be disabled
    const protectedCommands = ["commandtoggle", "disabledcommands", "settings", "help"];
    
    if (protectedCommands.includes(commandName)) {
      return interaction.reply({
        content: i18n.__("commandtoggle.protected"),
        ephemeral: true
      });
    }

    const disabledCommands = settings.disabledCommands || [];
    const isDisabled = disabledCommands.includes(commandName);

    if (isDisabled) {
      // Enable the command
      const newDisabled = disabledCommands.filter((c: string) => c !== commandName);
      await settingsService.updateSettings(guildId, { disabledCommands: newDisabled });
      
      const embed = new EmbedBuilder()
        .setTitle(i18n.__("commandtoggle.enabledTitle"))
        .setDescription(i18n.__mf("commandtoggle.enabled", { command: commandName }))
        .setColor("#00FF00");

      return interaction.reply({ embeds: [embed] });
    } else {
      // Disable the command
      disabledCommands.push(commandName);
      await settingsService.updateSettings(guildId, { disabledCommands });
      
      const embed = new EmbedBuilder()
        .setTitle(i18n.__("commandtoggle.disabledTitle"))
        .setDescription(i18n.__mf("commandtoggle.disabled", { command: commandName }))
        .setColor("#FF0000");

      return interaction.reply({ embeds: [embed] });
    }
  }
};
