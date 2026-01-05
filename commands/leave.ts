import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription(i18n.__("leave.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.member as GuildMember;

    const hasDJ = await hasDJPermission(guildMember);
    if (!hasDJ) {
      return interaction.editReply({ 
        content: "❌ You need the DJ role to use this command."
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue || !queue.connection) {
      return interaction.editReply({ content: i18n.__("leave.errorNotInChannel") }).catch(console.error);
    }

    const channelName = queue.channel?.name || "voice channel";
    
    // Destroy the queue which disconnects the bot
    queue.delete();
    
    await logAction(interaction.guild!, interaction.user, "leave", channelName);
    
    return interaction.editReply({ 
      content: i18n.__mf("leave.result", { channel: channelName })
    }).catch(console.error);
  }
};
