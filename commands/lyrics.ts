import {
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SeparatorSpacingSize,
  SlashCommandBuilder
} from "discord.js";
import { DiscordPlayerService, isGuessGameQueue } from "../services/discordPlayer";
import { canGoLive } from "../services/liveLyrics";
import { findLyrics } from "../services/lyrics";
import { safeText, truncate } from "../utils/format";
import { descriptionLocalizations, i18n } from "../utils/i18n";

/**
 * /lyrics [query] — lyrics of what's playing, or of any song by name.
 * Installable on a user account too, so it works in DMs and other servers.
 * For the playing song with synced lyrics, a "Live" button opens the live
 * view (services/liveLyrics.ts) that follows the player line by line.
 */
export default {
  data: new SlashCommandBuilder()
    .setName("lyrics")
    .setDescription(i18n.__("lyrics.description"))
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription(i18n.__("lyricsCmd.optionQuery"))
        .setDescriptionLocalizations(descriptionLocalizations("lyricsCmd.optionQuery") ?? {})
        .setMaxLength(200)
    )
    .addBooleanOption((option) => option.setName("private").setDescription("Only you see the lyrics")),
  cooldown: 4,
  category: "info",
  userInstallable: true,

  async execute(interaction: ChatInputCommandInteraction) {
    const query = interaction.options.getString("query")?.trim();
    const queue = interaction.guildId ? DiscordPlayerService.getInstance().getQueue(interaction.guildId) : null;
    const track = queue && !queue.deleted ? queue.currentTrack : null;

    if (!query && !track) {
      return interaction.reply({ content: `🎤 ${i18n.__("lyricsCmd.needQuery")}`, flags: MessageFlags.Ephemeral });
    }
    if (!query && isGuessGameQueue(queue)) {
      return interaction.reply({ content: `🎮 ${i18n.__("lyrics.liveNotDuringGame")}`, flags: MessageFlags.Ephemeral });
    }

    const ephemeral = interaction.options.getBoolean("private") ?? false;
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {});

    const title = query ?? track!.title;
    const author = query ? "" : track!.author || "";
    const result = query ? await findLyrics(title) : await findLyrics(title, author, { durationMs: track!.durationMS, preferSynced: true });

    if (!result) {
      return interaction.editReply({ content: `🎤 ${i18n.__mf("lyrics.lyricsNotFound", { title: safeText(title, 80) })}` });
    }

    const live = !query && interaction.inCachedGuild() && canGoLive(result, track);
    const footer = [i18n.__mf("lyricsCmd.source", { source: result.source })];
    if (live) footer.push(i18n.__("lyrics.liveHint"));

    const container = new ContainerBuilder()
      .setAccentColor(0xf8aa2a)
      .addTextDisplayComponents((t) => t.setContent(`### 🎤 ${safeText(result.title, 80)} — ${safeText(result.artist, 60)}`))
      .addTextDisplayComponents((t) => t.setContent(truncate(result.text, 3700)))
      .addTextDisplayComponents((t) => t.setContent(`-# ${footer.join(" · ")}`));

    if (live) {
      container
        .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents((row) =>
          row.setComponents(
            new ButtonBuilder()
              .setCustomId("lyrics:live")
              .setEmoji("🔴")
              .setLabel(i18n.__("lyrics.liveButton"))
              .setStyle(ButtonStyle.Primary)
          )
        );
    }

    return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 } as any);
  }
};
