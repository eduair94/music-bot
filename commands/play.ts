import { QueryType } from "discord-player";
import { AutocompleteInteraction, ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { searchYouTubeWithin } from "../services/youtubeSearch";
import { truncate } from "../utils/format";
import { descriptionLocalizations, i18n } from "../utils/i18n";
import { runPlay } from "../utils/playFlow";

const SOURCES: Record<string, (typeof QueryType)[keyof typeof QueryType]> = {
  youtube: QueryType.YOUTUBE_SEARCH,
  soundcloud: QueryType.SOUNDCLOUD_SEARCH
};

/**
 * Autocomplete: real YouTube results as you type (title · channel · length),
 * or, with an empty box, what this server played recently. Choice values are
 * plain video URLs, so picking one plays exactly that video.
 */
async function autocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused().trim();

  if (!focused) {
    const queue = interaction.guildId ? DiscordPlayerService.getInstance().getQueue(interaction.guildId) : null;
    const recent = queue ? [queue.currentTrack, ...queue.history.tracks.toArray()].filter(Boolean) : [];
    const seen = new Set<string>();
    const choices = recent
      .filter((t) => t && t.url.length <= 100 && !seen.has(t.url) && seen.add(t.url))
      .slice(0, 10)
      .map((t) => ({ name: truncate(`🕘 ${t!.title} — ${t!.author}`, 100), value: t!.url }));
    return interaction.respond(choices);
  }

  // Links are played as typed; nothing to suggest.
  if (/^https?:\/\//i.test(focused)) {
    return interaction.respond(focused.length <= 100 ? [{ name: truncate(focused, 100), value: focused }] : []);
  }

  const source = interaction.options.getString("source");
  if (source && source !== "youtube") {
    return interaction.respond([{ name: truncate(`🔍 ${focused}`, 100), value: truncate(focused, 100) }]);
  }

  // Discord drops autocomplete answers after 3 s.
  const results = await searchYouTubeWithin(focused, 2300, 9);
  const choices = results
    .filter((r) => r.url.length <= 100)
    .map((r) => ({
      name: truncate(`${r.isLive ? "🔴" : "🎵"} ${r.title} — ${r.author}${r.durationText ? ` (${r.durationText})` : ""}`, 100),
      value: r.url
    }));
  // Always offer the raw text too, so a plain search is one Enter away.
  choices.unshift({ name: truncate(`🔍 ${i18n.__mf("play.searchSuggestion", { query: focused })}`, 100), value: truncate(focused, 100) });
  return interaction.respond(choices.slice(0, 25));
}

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription(i18n.__("play.description"))
    .addStringOption((option) =>
      option
        .setName("song")
        .setDescription(i18n.__("play.optionSong"))
        .setDescriptionLocalizations(descriptionLocalizations("play.optionSong") ?? {})
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("next")
        .setDescription(i18n.__("play.optionNext"))
        .setDescriptionLocalizations(descriptionLocalizations("play.optionNext") ?? {})
    )
    .addStringOption((option) =>
      option
        .setName("source")
        .setDescription(i18n.__("play.optionSource"))
        .setDescriptionLocalizations(descriptionLocalizations("play.optionSource") ?? {})
        .addChoices({ name: "YouTube", value: "youtube" }, { name: "SoundCloud", value: "soundcloud" })
    ),
  cooldown: 2,
  category: "music",
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  autocomplete,

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const source = interaction.options.getString("source") ?? "youtube";
    return runPlay({
      interaction,
      query: interaction.options.getString("song", true),
      next: interaction.options.getBoolean("next") ?? false,
      searchEngine: SOURCES[source] ?? QueryType.YOUTUBE_SEARCH
    });
  }
};
