import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  TextChannel,
  Message,
  Collection
} from "discord.js";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("clean")
    .setDescription(i18n.__("clean.description"))
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Number of bot messages to delete (1-100)")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  cooldown: 10,
  permissions: [PermissionFlagsBits.ManageMessages],
  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger("amount") || 50;
    const channel = interaction.channel as TextChannel;

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        content: i18n.__("common.errorCommand"),
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Fetch recent messages
      const messages: Collection<string, Message> = await channel.messages.fetch({ limit: 100 });
      
      // Filter for bot messages only (messages from this bot)
      const botMessages = messages.filter(
        (msg: Message) => msg.author.id === interaction.client.user?.id
      );

      // Take only the requested amount
      const toDelete = Array.from(botMessages.values()).slice(0, amount);

      if (toDelete.length === 0) {
        return interaction.editReply({
          content: i18n.__("clean.noMessages")
        });
      }

      // Delete messages (bulk delete only works for messages < 14 days old)
      let deleted = 0;
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

      const bulkDeletable = toDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
      const oldMessages = toDelete.filter(msg => msg.createdTimestamp <= twoWeeksAgo);

      // Bulk delete recent messages
      if (bulkDeletable.length > 0) {
        try {
          const deletedMessages = await channel.bulkDelete(bulkDeletable, true);
          deleted += deletedMessages.size;
        } catch (error) {
          console.error("[clean] Bulk delete error:", error);
        }
      }

      // Delete old messages one by one (with rate limit consideration)
      for (const msg of oldMessages.slice(0, 5)) { // Limit to 5 old messages to avoid rate limits
        try {
          await msg.delete();
          deleted++;
        } catch (error) {
          // Message may have already been deleted
        }
      }

      return interaction.editReply({
        content: i18n.__mf("clean.success", { count: deleted })
      });

    } catch (error) {
      console.error("[clean] Error:", error);
      return interaction.editReply({
        content: i18n.__("clean.error")
      });
    }
  }
};
