import { ChannelType, EmbedBuilder, Guild, TextChannel, User } from "discord.js";
import { GuildSettingsService } from "../services/guildSettings";

/**
 * Action types for logging
 */
export type ActionType = 
  | "play" | "pause" | "resume" | "stop" | "skip"
  | "seek" | "seek_forward" | "seek_backward" | "forward" | "rewind" | "replay" | "backward"
  | "volume_change" | "shuffle" | "loop" | "loopqueue"
  | "setting_change" | "queue_clear" | "clear"
  | "join" | "leave" | "autoplay" | "previous" | "jump"
  | "swap" | "reverse" | "sort" | "removerange" | "removeduplicates" | "removelast"
  | "voteskip" | "grab" | "restart" | "insert" | "removecurrent";

/**
 * Get the log channel for a guild
 */
async function getLogChannel(guild: Guild): Promise<TextChannel | null> {
  const settingsService = GuildSettingsService.getInstance();
  const logChannelId = await settingsService.getLogChannelId(guild.id);
  
  // If explicitly disabled, don't log
  if (logChannelId === "disabled") {
    return null;
  }
  
  if (logChannelId) {
    const configuredChannel = guild.channels.cache.get(logChannelId);
    if (configuredChannel && configuredChannel.type === ChannelType.GuildText) {
      return configuredChannel as TextChannel;
    }
  }
  
  // Try to find "bot-commands" channel as fallback
  const botCommandsChannel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name.toLowerCase() === "bot-commands"
  );
  
  if (botCommandsChannel) {
    return botCommandsChannel as TextChannel;
  }
  
  return null;
}

/**
 * Get emoji for action type
 */
function getActionEmoji(action: ActionType): string {
  const emojis: Record<ActionType, string> = {
    play: "▶️",
    pause: "⏸️",
    resume: "▶️",
    stop: "⏹️",
    skip: "⏭️",
    seek: "⏩",
    seek_forward: "⏩",
    seek_backward: "⏪",
    forward: "⏩",
    rewind: "⏪",
    backward: "⏪",
    replay: "🔄",
    restart: "🔄",
    volume_change: "🔊",
    shuffle: "🔀",
    loop: "🔁",
    loopqueue: "🔁",
    setting_change: "⚙️",
    queue_clear: "🗑️",
    clear: "🗑️",
    join: "📥",
    leave: "👋",
    autoplay: "🔄",
    previous: "⏮️",
    jump: "⏭️",
    swap: "🔀",
    reverse: "🔄",
    sort: "📊",
    removerange: "❌",
    removeduplicates: "🧹",
    removelast: "↩️",
    voteskip: "🗳️",
    grab: "💾",
    insert: "⏭️",
    removecurrent: "🗑️",
  };
  return emojis[action] || "🎵";
}

/**
 * Get action description
 */
function getActionDescription(action: ActionType, details?: string): string {
  const descriptions: Record<ActionType, string> = {
    play: "Started playing",
    pause: "Paused playback",
    resume: "Resumed playback",
    stop: "Stopped playback",
    skip: "Skipped track",
    seek: "Seeked to position",
    seek_forward: "Seeked forward",
    seek_backward: "Seeked backward",
    forward: "Fast forwarded",
    rewind: "Rewound",
    backward: "Rewound",
    replay: "Restarted track",
    restart: "Restarted queue",
    volume_change: "Changed volume",
    shuffle: "Shuffled queue",
    loop: "Changed loop mode",
    loopqueue: "Changed queue loop mode",
    setting_change: "Updated settings",
    queue_clear: "Cleared queue",
    clear: "Cleared queue",
    join: "Joined channel",
    leave: "Left channel",
    autoplay: "Toggled autoplay",
    previous: "Played previous track",
    jump: "Jumped to track",
    swap: "Swapped tracks",
    reverse: "Reversed queue",
    sort: "Sorted queue",
    removerange: "Removed range",
    removeduplicates: "Removed duplicates",
    removelast: "Removed last track",
    voteskip: "Vote skipped",
    grab: "Grabbed track",
    insert: "Inserted track",
    removecurrent: "Removed current track",
  };
  
  let desc = descriptions[action] || action;
  if (details) {
    desc += ` • ${details}`;
  }
  return desc;
}

/**
 * Log an action to the guild's log channel
 */
export async function logAction(
  guild: Guild,
  user: User,
  action: ActionType,
  details?: string
): Promise<void> {
  try {
    const channel = await getLogChannel(guild);
    if (!channel) return;

    const emoji = getActionEmoji(action);
    const description = getActionDescription(action, details);
    
    // Simple inline message for quick actions
    const message = `${emoji} **${user.username}** ${description}`;
    
    await channel.send(message).catch(console.error);
  } catch (error) {
    console.error("[ActionLog] Error logging action:", error);
  }
}

/**
 * Log a setting change with more detail
 */
export async function logSettingChange(
  guild: Guild,
  user: User,
  settingName: string,
  oldValue: string,
  newValue: string
): Promise<void> {
  try {
    const channel = await getLogChannel(guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor("#FFA500")
      .setTitle("⚙️ Settings Updated")
      .setDescription(`**${user.username}** changed **${settingName}**`)
      .addFields(
        { name: "Before", value: oldValue || "Not set", inline: true },
        { name: "After", value: newValue || "Not set", inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `User ID: ${user.id}` });

    await channel.send({ embeds: [embed] }).catch(console.error);
  } catch (error) {
    console.error("[ActionLog] Error logging setting change:", error);
  }
}
