import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, TextChannel } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription(i18n.__("join.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.member as GuildMember;
    const voiceChannel = guildMember.voice.channel;

    if (!voiceChannel) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const player = playerService.getPlayer();
    
    if (!player) {
      return interaction.editReply({ 
        content: i18n.__("join.errorCantJoin")
      }).catch(console.error);
    }
    
    try {
      // Check if bot is already in a different channel
      const existingQueue = playerService.getQueue(interaction.guild!.id);
      if (existingQueue && existingQueue.channel && existingQueue.channel.id !== voiceChannel.id) {
        return interaction.editReply({ 
          content: i18n.__("join.errorDifferentChannel")
        }).catch(console.error);
      }
      
      // Connect to the voice channel using the player
      // Server settings decide volume, leave timers and 24/7.
      const queue = await playerService.createQueue(interaction.guild!, interaction.channel as TextChannel);
      
      if (!queue.connection) {
        await queue.connect(voiceChannel);
      }
      
      return interaction.editReply({ 
        content: i18n.__mf("join.result", { channel: voiceChannel.name })
      }).catch(console.error);
    } catch (error) {
      console.error("[join] Error:", error);
      return interaction.editReply({ 
        content: i18n.__("join.errorCantJoin")
      }).catch(console.error);
    }
  }
};
