import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder().setName("skip").setDescription(i18n.__("skip.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!canModifyQueue(guildMember!)) {
      return interaction.reply({ content: i18n.__("common.errorNotChannel"), ephemeral: true }).catch(console.error);
    }

    // Check DJ permission
    const hasDJ = await hasDJPermission(guildMember as GuildMember);
    if (!hasDJ) {
      return interaction.reply({ 
        content: "❌ You need the DJ role to use this command.", 
        ephemeral: true 
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue) {
      console.log(`[skip] No queue found for guild ${interaction.guild!.id}`);
      return interaction.reply({ content: i18n.__("skip.errorNotQueue"), ephemeral: true }).catch(console.error);
    }

    // Get current track info before skipping
    const currentTrack = queue.currentTrack;
    
    // Check if there's a track in queue (either currently playing or in tracks list)
    if (!currentTrack && queue.tracks.size === 0) {
      console.log(`[skip] No current track and empty queue for guild ${interaction.guild!.id}`);
      return interaction.reply({ content: i18n.__("skip.errorNotQueue"), ephemeral: true }).catch(console.error);
    }

    // If there's a currentTrack, skip it. If not but there are tracks in queue, still try to skip
    const trackTitle = currentTrack?.title || "current track";
    console.log(`[skip] Skipping: ${trackTitle}`);
    
    // Skip the current track
    queue.node.skip();
    
    return safeReply(interaction, i18n.__mf("skip.result", { author: interaction.user.id }));
  }
};
