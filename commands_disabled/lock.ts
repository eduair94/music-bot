import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember, 
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

// Track locked queues
const lockedQueues = new Map<string, string>(); // guildId -> userId

export default {
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription(i18n.__("lock.description"))
    .addSubcommand(sub =>
      sub
        .setName("enable")
        .setDescription(i18n.__("lock.enable.description"))
    )
    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription(i18n.__("lock.disable.description"))
    )
    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription(i18n.__("lock.status.description"))
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("lock.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(guildId);
    
    if (!queue) {
      return interaction.reply({
        content: i18n.__("lock.noQueue"),
        ephemeral: true
      });
    }

    switch (subcommand) {
      case "enable": {
        // Check if already locked
        if (lockedQueues.has(guildId)) {
          const lockOwner = lockedQueues.get(guildId);
          return interaction.reply({
            content: i18n.__mf("lock.alreadyLocked", { userId: lockOwner }),
            ephemeral: true
          });
        }

        lockedQueues.set(guildId, interaction.user.id);
        
        const embed = new EmbedBuilder()
          .setTitle(i18n.__("lock.lockedTitle"))
          .setDescription(i18n.__mf("lock.locked", { user: interaction.user.username }))
          .setColor("#F8AA2A");

        return interaction.reply({ embeds: [embed] });
      }

      case "disable": {
        // Check if locked
        if (!lockedQueues.has(guildId)) {
          return interaction.reply({
            content: i18n.__("lock.notLocked"),
            ephemeral: true
          });
        }

        // Check if user is the lock owner or admin
        const lockOwner = lockedQueues.get(guildId);
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
        
        if (lockOwner !== interaction.user.id && !isAdmin) {
          return interaction.reply({
            content: i18n.__("lock.notOwner"),
            ephemeral: true
          });
        }

        lockedQueues.delete(guildId);
        
        const embed = new EmbedBuilder()
          .setTitle(i18n.__("lock.unlockedTitle"))
          .setDescription(i18n.__("lock.unlocked"))
          .setColor("#F8AA2A");

        return interaction.reply({ embeds: [embed] });
      }

      case "status": {
        const isLocked = lockedQueues.has(guildId);
        const embed = new EmbedBuilder()
          .setTitle(i18n.__("lock.statusTitle"))
          .setColor("#F8AA2A");

        if (isLocked) {
          embed.setDescription(i18n.__mf("lock.statusLocked", { 
            userId: lockedQueues.get(guildId) 
          }));
        } else {
          embed.setDescription(i18n.__("lock.statusUnlocked"));
        }

        return interaction.reply({ embeds: [embed] });
      }
    }
  }
};
