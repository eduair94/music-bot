import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { splitBar } from "string-progressbar";
import { DiscordPlayerService, QueueMetadata } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { getQualityBadge } from "../utils/audioSettings";
import { i18n } from "../utils/i18n";

/**
 * Create playback control buttons
 */
function createPlaybackButtons(isPaused: boolean): ActionRowBuilder<ButtonBuilder>[] {
  // Row 1: Main controls
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("np_rewind_60")
      .setLabel("⏪ 1m")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_rewind_30")
      .setLabel("⏪ 30s")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_rewind_10")
      .setLabel("⏪ 10s")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(isPaused ? "np_resume" : "np_pause")
      .setLabel(isPaused ? "▶️ Play" : "⏸️ Pause")
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("np_stop")
      .setLabel("⏹️ Stop")
      .setStyle(ButtonStyle.Danger)
  );

  // Row 2: Forward controls and skip
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("np_forward_10")
      .setLabel("10s ⏩")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_forward_30")
      .setLabel("30s ⏩")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_forward_60")
      .setLabel("1m ⏩")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np_skip")
      .setLabel("⏭️ Skip")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("np_refresh")
      .setLabel("🔄")
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2];
}

/**
 * Create the now playing embed
 */
function createNowPlayingEmbed(
  queue: ReturnType<DiscordPlayerService["getQueue"]>,
  track: NonNullable<ReturnType<DiscordPlayerService["getQueue"]>>["currentTrack"],
  metadata: QueueMetadata
): EmbedBuilder {
  if (!queue || !track) {
    return new EmbedBuilder()
      .setTitle("❌ Nothing Playing")
      .setDescription("There is no track currently playing.")
      .setColor("#FF0000");
  }

  const progress = queue.node.getTimestamp();
  const qualityBadge = getQualityBadge(metadata.audioBitrate);
  const isPaused = queue.node.isPaused();
  
  const embed = new EmbedBuilder()
    .setTitle(`${isPaused ? "⏸️" : "▶️"} ${i18n.__("nowplaying.embedTitle")}`)
    .setDescription(`**[${track.title}](${track.url})**`)
    .setColor(isPaused ? "#FFA500" : "#00FF00")
    .addFields(
      { name: "🎤 Artist", value: track.author || "Unknown", inline: true },
      { name: "🎵 Source", value: track.source || "Unknown", inline: true },
      { name: "🔊 Quality", value: qualityBadge, inline: true }
    );

  if (track.thumbnail) {
    embed.setThumbnail(track.thumbnail);
  }

  if (progress && track.durationMS > 0) {
    const seek = progress.current.value / 1000;
    const duration = track.durationMS / 1000;
    const left = duration - seek;

    const progressBar = splitBar(duration, seek, 20)[0];
    const currentTime = new Date(seek * 1000).toISOString().substr(11, 8);
    const totalTime = new Date(duration * 1000).toISOString().substr(11, 8);

    embed.addFields({
      name: "⏱️ Progress",
      value: `\`${currentTime}\` [${progressBar}] \`${totalTime}\``,
      inline: false
    });

    embed.setFooter({
      text: `⏳ ${i18n.__mf("nowplaying.timeRemaining", { time: new Date(left * 1000).toISOString().substr(11, 8) })} • Queue: ${queue.tracks.size} tracks`
    });
  }

  return embed;
}

export default {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription(i18n.__("nowplaying.description")),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    // Get metadata with fallback
    const metadata = (queue?.metadata || {}) as QueueMetadata;
    
    // Use queue.metadata.currentTrack as a fallback if queue.currentTrack is null
    let track = queue?.currentTrack;
    if (!track && metadata.currentTrack) {
      track = metadata.currentTrack;
    }
    
    if (!queue || !track) {
      return interaction.reply({ content: i18n.__("nowplaying.errorNotQueue"), ephemeral: true }).catch(console.error);
    }

    const isPaused = queue.node.isPaused();
    const embed = createNowPlayingEmbed(queue, track, metadata);
    const buttons = createPlaybackButtons(isPaused);

    const response = await interaction.reply({ 
      embeds: [embed], 
      components: buttons,
      fetchReply: true 
    });

    // Create button collector
    const collector = response.createMessageComponentCollector({ 
      time: 120000 // 2 minutes
    });

    collector.on("collect", async (buttonInteraction) => {
      // Verify user is in voice channel
      const member = buttonInteraction.guild?.members.cache.get(buttonInteraction.user.id);
      const voiceChannel = member?.voice?.channel;
      const botVoiceChannel = queue.channel;

      if (!voiceChannel || voiceChannel.id !== botVoiceChannel?.id) {
        return buttonInteraction.reply({ 
          content: "❌ You must be in the same voice channel to use these controls.", 
          ephemeral: true 
        }).catch(console.error);
      }

      const currentQueue = playerService.getQueue(interaction.guild!.id);
      if (!currentQueue) {
        return buttonInteraction.reply({ 
          content: "❌ No music is currently playing.", 
          ephemeral: true 
        }).catch(console.error);
      }

      try {
        const guild = interaction.guild!;
        const user = buttonInteraction.user;
        const trackTitle = currentQueue.currentTrack?.title || "Unknown";
        
        switch (buttonInteraction.customId) {
          case "np_pause":
            currentQueue.node.pause();
            await logAction(guild, user, "pause", trackTitle);
            await buttonInteraction.deferUpdate();
            break;
            
          case "np_resume":
            currentQueue.node.resume();
            await logAction(guild, user, "resume", trackTitle);
            await buttonInteraction.deferUpdate();
            break;
            
          case "np_stop":
            await logAction(guild, user, "stop", trackTitle);
            currentQueue.delete();
            await buttonInteraction.update({ 
              embeds: [new EmbedBuilder().setTitle("⏹️ Stopped").setColor("#FF0000")], 
              components: [] 
            });
            collector.stop();
            return;
            
          case "np_skip":
            await logAction(guild, user, "skip", trackTitle);
            currentQueue.node.skip();
            await buttonInteraction.deferUpdate();
            break;
            
          case "np_rewind_10":
            await seekRelative(currentQueue, -10);
            await logAction(guild, user, "seek_backward", "10 seconds");
            await buttonInteraction.deferUpdate();
            break;
            
          case "np_rewind_30":
            await seekRelative(currentQueue, -30);
            await logAction(guild, user, "seek_backward", "30 seconds");
            await buttonInteraction.deferUpdate();
            break;
            
          case "np_rewind_60":
            await seekRelative(currentQueue, -60);
            await logAction(guild, user, "seek_backward", "1 minute");
            await buttonInteraction.deferUpdate();
            break;
            
          case "np_forward_10":
            await seekRelative(currentQueue, 10);
            await logAction(guild, user, "seek_forward", "10 seconds");
            await buttonInteraction.deferUpdate();
            break;
            
          case "np_forward_30":
            await seekRelative(currentQueue, 30);
            await logAction(guild, user, "seek_forward", "30 seconds");
            await buttonInteraction.deferUpdate();
            break;
            
          case "np_forward_60":
            await seekRelative(currentQueue, 60);
            await logAction(guild, user, "seek_forward", "1 minute");
            await buttonInteraction.deferUpdate();
            break;
            
          case "np_refresh":
            await buttonInteraction.deferUpdate();
            break;
        }

        // Update the embed with new state
        const updatedQueue = playerService.getQueue(interaction.guild!.id);
        const updatedMetadata = (updatedQueue?.metadata || {}) as QueueMetadata;
        let updatedTrack = updatedQueue?.currentTrack;
        if (!updatedTrack && updatedMetadata.currentTrack) {
          updatedTrack = updatedMetadata.currentTrack;
        }

        if (updatedQueue && updatedTrack) {
          const newEmbed = createNowPlayingEmbed(updatedQueue, updatedTrack, updatedMetadata);
          const newButtons = createPlaybackButtons(updatedQueue.node.isPaused());
          await interaction.editReply({ embeds: [newEmbed], components: newButtons }).catch(console.error);
        }
      } catch (error) {
        console.error("[nowplaying] Button error:", error);
        await buttonInteraction.reply({ 
          content: "❌ An error occurred while processing your request.", 
          ephemeral: true 
        }).catch(console.error);
      }
    });

    collector.on("end", async () => {
      // Remove buttons when collector expires
      const finalQueue = playerService.getQueue(interaction.guild!.id);
      const finalMetadata = (finalQueue?.metadata || {}) as QueueMetadata;
      let finalTrack = finalQueue?.currentTrack;
      if (!finalTrack && finalMetadata.currentTrack) {
        finalTrack = finalMetadata.currentTrack;
      }

      if (finalQueue && finalTrack) {
        const finalEmbed = createNowPlayingEmbed(finalQueue, finalTrack, finalMetadata);
        await interaction.editReply({ embeds: [finalEmbed], components: [] }).catch(console.error);
      }
    });
  }
};

/**
 * Seek relative to current position
 */
async function seekRelative(queue: NonNullable<ReturnType<DiscordPlayerService["getQueue"]>>, seconds: number): Promise<void> {
  const progress = queue.node.getTimestamp();
  if (!progress) return;

  const currentMs = progress.current.value;
  const durationMs = queue.currentTrack?.durationMS || 0;
  
  let newPositionMs = currentMs + (seconds * 1000);
  
  // Clamp to valid range
  if (newPositionMs < 0) newPositionMs = 0;
  if (newPositionMs > durationMs) newPositionMs = durationMs - 1000;
  
  await queue.node.seek(newPositionMs);
}
