import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember, 
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";
import { hasPremiumFeature } from "../utils/premiumCheck";

// Track 24/7 mode per guild
const twentyFourSevenMode = new Map<string, boolean>();

export default {
  data: new SlashCommandBuilder()
    .setName("247")
    .setDescription(i18n.__("247.description"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const guildId = interaction.guildId!;

    // Check premium status
    const isPremium = await hasPremiumFeature(interaction.user.id, "stay_24_7");
    
    if (!isPremium) {
      return interaction.reply({
        content: i18n.__("247.premiumRequired"),
        ephemeral: true
      });
    }

    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("247.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(guildId);
    
    if (!queue) {
      return interaction.reply({
        content: i18n.__("247.noQueue"),
        ephemeral: true
      });
    }

    // Toggle 24/7 mode
    const currentMode = twentyFourSevenMode.get(guildId) || false;
    const newMode = !currentMode;
    twentyFourSevenMode.set(guildId, newMode);

    // Update queue settings
    if (newMode) {
      queue.node.setVolume(queue.node.volume); // Keep current volume
      // Disable leave on empty/end
    }

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("247.title"))
      .setDescription(newMode 
        ? i18n.__("247.enabled") 
        : i18n.__("247.disabled")
      )
      .setColor(newMode ? "#00FF00" : "#F8AA2A")
      .setFooter({ text: i18n.__("247.footer") });

    return interaction.reply({ embeds: [embed] });
  }
};

// Export for use in event handlers
export function is247Mode(guildId: string): boolean {
  return twentyFourSevenMode.get(guildId) || false;
}
