import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder().setName("skip").setDescription(i18n.__("skip.description")),
  async execute(interaction: ChatInputCommandInteraction) {
    // Defer reply immediately to prevent interaction timeout
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    // Check DJ permission
    const hasDJ = await hasDJPermission(guildMember as GuildMember);
    if (!hasDJ) {
      return interaction.editReply({ 
        content: "❌ You need the DJ role to use this command."
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    // Only check if queue exists - if it does, we can skip
    // The queue existing means there's an active player session
    if (!queue) {
      console.log(`[skip] No queue found for guild ${interaction.guild!.id}`);
      return interaction.editReply({ content: i18n.__("skip.errorNotQueue") }).catch(console.error);
    }

    // Check if queue is deleted/inactive
    if (queue.deleted) {
      console.log(`[skip] Queue is deleted for guild ${interaction.guild!.id}`);
      return interaction.editReply({ content: i18n.__("skip.errorNotQueue") }).catch(console.error);
    }

    // Get current track info for logging (may be null during transitions)
    const currentTrack = queue.currentTrack;
    const trackTitle = currentTrack?.title || "current track";
    console.log(`[skip] Skipping: ${trackTitle}`);
    console.log(`[skip] Queue size before skip: ${queue.tracks.size}`);
    console.log(`[skip] Next track in queue: ${queue.tracks.at(0)?.title || 'none'}`);
    
    // Skip the current track - this works even during track transitions
    const skipResult = queue.node.skip();
    console.log(`[skip] Skip result: ${skipResult}`);
    console.log(`[skip] Queue is playing after skip: ${queue.node.isPlaying()}`);
    console.log(`[skip] Queue is idle after skip: ${queue.node.isIdle()}`);
    
    return interaction.editReply({ content: i18n.__mf("skip.result", { author: interaction.user.id }) }).catch(console.error);
  }
};
