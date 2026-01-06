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
    .setName("disabledcommands")
    .setDescription(i18n.__("disabledcommands.description"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const settingsService = GuildSettingsService.getInstance();
    const settings = await settingsService.getSettings(guildId);

    const disabledCommands = settings.disabledCommands || [];

    if (disabledCommands.length === 0) {
      return interaction.reply({
        content: i18n.__("disabledcommands.none"),
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("disabledcommands.title"))
      .setDescription(disabledCommands.map((c: string) => `\`/${c}\``).join(", "))
      .setColor("#F8AA2A")
      .setFooter({ text: i18n.__mf("disabledcommands.footer", { count: disabledCommands.length }) });

    return interaction.reply({ embeds: [embed] });
  }
};
