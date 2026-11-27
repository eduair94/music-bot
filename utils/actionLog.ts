import { ChannelType, EmbedBuilder, Guild, TextChannel, User } from "discord.js";
import { GuildSettingsService } from "../services/guildSettings";
import { localeForGuild } from "./guildLocale";
import { i18n, runWithLocale } from "./i18n";

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
  | "voteskip" | "grab" | "restart" | "insert" | "removecurrent" | "playlists";

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
    playlists: "📁",
  };
  return emojis[action] || "🎵";
}

/**
 * Get action description, in the active locale (actionLog.action.<type>).
 */
function getActionDescription(action: ActionType, details?: string): string {
  let desc = i18n.__(`actionLog.action.${action}`);
  if (details) {
    desc += ` • ${details}`;
  }
  return desc;
}

/**
 * Log an action to the guild's log channel. The log channel is shared by the
 * whole server, so it is written in the server's language, not the language
 * of the member who ran the command. Pass `details` as a function when it
 * contains translatable text, so it is rendered in that language too.
 */
export async function logAction(
  guild: Guild,
  user: User,
  action: ActionType,
  details?: string | (() => string)
): Promise<void> {
  try {
    const channel = await getLogChannel(guild);
    if (!channel) return;

    const locale = await localeForGuild(guild);
    const message = runWithLocale(locale, () => {
      const emoji = getActionEmoji(action);
      const description = getActionDescription(action, typeof details === "function" ? details() : details);
      // Simple inline message for quick actions
      return `${emoji} **${user.username}** ${description}`;
    });

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

    const locale = await localeForGuild(guild);
    const embed = runWithLocale(locale, () =>
      new EmbedBuilder()
        .setColor("#FFA500")
        .setTitle(`⚙️ ${i18n.__("actionLog.settings.title")}`)
        .setDescription(i18n.__mf("actionLog.settings.changed", { user: `**${user.username}**`, setting: `**${settingName}**` }))
        .addFields(
          { name: i18n.__("actionLog.settings.before"), value: oldValue || i18n.__("actionLog.settings.notSet"), inline: true },
          { name: i18n.__("actionLog.settings.after"), value: newValue || i18n.__("actionLog.settings.notSet"), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: i18n.__mf("actionLog.settings.userId", { id: user.id }) })
    );

    await channel.send({ embeds: [embed] }).catch(console.error);
  } catch (error) {
    console.error("[ActionLog] Error logging setting change:", error);
  }
}
