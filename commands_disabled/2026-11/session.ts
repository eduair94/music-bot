import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember, 
  SlashCommandBuilder 
} from "discord.js";
import { useQueue } from "discord-player";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

// Track session data
const sessionOwners = new Map<string, string>(); // guildId -> userId
const lockedQueues = new Map<string, string>(); // guildId -> userId

export default {
  data: new SlashCommandBuilder()
    .setName("session")
    .setDescription("Manage music session")
    // Claim ownership
    .addSubcommand(sub => sub
      .setName("claim")
      .setDescription("Claim ownership of the session"))
    // Transfer ownership
    .addSubcommand(sub => sub
      .setName("transfer")
      .setDescription("Transfer ownership to another user")
      .addUserOption(opt => opt.setName("user").setDescription("User to transfer to").setRequired(true)))
    // View owner
    .addSubcommand(sub => sub
      .setName("owner")
      .setDescription("View current session owner"))
    // Lock session
    .addSubcommand(sub => sub
      .setName("lock")
      .setDescription("Lock the session (only you can control it)"))
    // Unlock session
    .addSubcommand(sub => sub
      .setName("unlock")
      .setDescription("Unlock the session"))
    // Session status
    .addSubcommand(sub => sub
      .setName("status")
      .setDescription("View session status")),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (!canModifyQueue(member)) {
      return interaction.reply({ content: i18n.__("common.errorNotChannel"), ephemeral: true });
    }

    const queue = useQueue(guildId);
    
    if (!queue) {
      return interaction.reply({ content: "❌ No active session.", ephemeral: true });
    }

    switch (subcommand) {
      case "claim": {
        const currentOwner = sessionOwners.get(guildId);
        
        if (currentOwner) {
          const vc = queue.channel;
          if (vc && vc.members.has(currentOwner)) {
            const embed = new EmbedBuilder()
              .setTitle("❌ Session Already Owned")
              .setColor(0xe74c3c)
              .setDescription(`This session is already owned by <@${currentOwner}>.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
        }

        sessionOwners.set(guildId, interaction.user.id);
        
        const embed = new EmbedBuilder()
          .setTitle("👑 Ownership Claimed")
          .setColor(0x2ecc71)
          .setDescription(`${interaction.user} is now the session owner.`);
        
        return interaction.reply({ embeds: [embed] });
      }

      case "transfer": {
        const currentOwner = sessionOwners.get(guildId);
        
        if (currentOwner !== interaction.user.id) {
          const hasDJ = await hasDJPermission(member);
          if (!hasDJ) {
            return interaction.reply({ 
              content: "❌ Only the session owner or DJ can transfer ownership.", 
              ephemeral: true 
            });
          }
        }

        const targetUser = interaction.options.getUser("user", true);
        sessionOwners.set(guildId, targetUser.id);
        
        const embed = new EmbedBuilder()
          .setTitle("👑 Ownership Transferred")
          .setColor(0x3498db)
          .setDescription(`Session ownership transferred to ${targetUser}.`);
        
        return interaction.reply({ embeds: [embed] });
      }

      case "owner": {
        const currentOwner = sessionOwners.get(guildId);
        
        const embed = new EmbedBuilder()
          .setTitle("👑 Session Owner")
          .setColor(0x9b59b6)
          .setDescription(currentOwner 
            ? `Current owner: <@${currentOwner}>`
            : "No owner set. Use `/session claim` to claim ownership.");
        
        return interaction.reply({ embeds: [embed] });
      }

      case "lock": {
        if (lockedQueues.has(guildId)) {
          const lockOwner = lockedQueues.get(guildId);
          return interaction.reply({
            content: `❌ Session already locked by <@${lockOwner}>.`,
            ephemeral: true
          });
        }

        lockedQueues.set(guildId, interaction.user.id);
        
        const embed = new EmbedBuilder()
          .setTitle("🔒 Session Locked")
          .setColor(0xf39c12)
          .setDescription(`${interaction.user.username} has locked the session.`);

        return interaction.reply({ embeds: [embed] });
      }

      case "unlock": {
        if (!lockedQueues.has(guildId)) {
          return interaction.reply({ content: "❌ Session is not locked.", ephemeral: true });
        }

        const lockOwner = lockedQueues.get(guildId);
        const hasDJ = await hasDJPermission(member);
        
        if (lockOwner !== interaction.user.id && !hasDJ) {
          return interaction.reply({ 
            content: "❌ Only the lock owner or DJ can unlock.", 
            ephemeral: true 
          });
        }

        lockedQueues.delete(guildId);
        
        const embed = new EmbedBuilder()
          .setTitle("🔓 Session Unlocked")
          .setColor(0x2ecc71)
          .setDescription("The session has been unlocked.");

        return interaction.reply({ embeds: [embed] });
      }

      case "status": {
        const currentOwner = sessionOwners.get(guildId);
        const isLocked = lockedQueues.has(guildId);
        const lockOwner = lockedQueues.get(guildId);

        const embed = new EmbedBuilder()
          .setTitle("📊 Session Status")
          .setColor(0x3498db)
          .addFields(
            { name: "Owner", value: currentOwner ? `<@${currentOwner}>` : "None", inline: true },
            { name: "Locked", value: isLocked ? `🔒 by <@${lockOwner}>` : "🔓 No", inline: true },
            { name: "Tracks", value: `${queue.tracks.size}`, inline: true },
            { name: "Loop", value: queue.repeatMode === 0 ? "Off" : queue.repeatMode === 1 ? "Track" : "Queue", inline: true }
          );

        return interaction.reply({ embeds: [embed] });
      }

      default:
        return interaction.reply({ content: "❌ Unknown subcommand.", ephemeral: true });
    }
  }
};
