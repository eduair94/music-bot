import { Collection } from "discord.js";
import { Command, CommandCategory, ContextMenuCommand } from "../interfaces/Command";

/**
 * Loaded commands and their Discord ids, shared without importing the Bot
 * instance (which would create an import cycle through index.ts).
 */
export const commands = new Collection<string, Command>();
export const contextMenus = new Collection<string, ContextMenuCommand>();
const ids = new Map<string, string>();

export function setCommandId(name: string, id: string): void {
  ids.set(name, id);
}

/** A clickable command mention (`</play:123>`), or plain `/play` before registration. */
export function mention(name: string, subcommand?: string): string {
  const id = ids.get(name);
  const full = subcommand ? `${name} ${subcommand}` : name;
  return id ? `</${full}:${id}>` : `/${full}`;
}

export function commandId(name: string): string | undefined {
  return ids.get(name);
}

/** Fallback categories for commands that don't declare one. */
const CATEGORY_BY_NAME: Record<string, CommandCategory> = {
  play: "music",
  playnext: "music",
  playnow: "music",
  play_file: "music",
  play_spotify: "music",
  search: "music",
  radio: "music",
  ai: "music",
  pause: "music",
  resume: "music",
  skip: "music",
  voteskip: "music",
  stop: "music",
  previous: "music",
  replay: "music",
  seek: "music",
  rewind: "music",
  jump: "music",
  loop: "music",
  autoplay: "music",
  join: "music",
  leave: "music",
  "247": "music",
  rebind: "music",
  nowplaying: "info",
  queue: "queue",
  queuemanage: "queue",
  shuffle: "queue",
  remove: "queue",
  move: "queue",
  clear: "queue",
  effects: "effects",
  volume: "effects",
  collections: "playlists",
  playlists: "playlists",
  library: "playlists",
  grab: "playlists",
  lyrics: "info",
  info: "info",
  stats: "info",
  ping: "info",
  user: "info",
  settings: "settings",
  language: "settings",
  commanddisable: "settings",
  commandenable: "settings",
  commanddisableall: "settings",
  commandenableall: "settings",
  say: "other",
  sayconfig: "settings",
  premium: "premium",
  perks: "premium",
  patreon: "premium",
  vote: "premium",
  help: "other",
  invite: "other",
  feedback: "other",
  dashboard: "other"
};

export function categoryOf(command: Command): CommandCategory {
  return command.category ?? CATEGORY_BY_NAME[command.data.name] ?? "other";
}
