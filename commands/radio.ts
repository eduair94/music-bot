import { ChatInputCommandInteraction, GuildMember, MessageFlags, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { aiAccess, AI_RADIO_BATCH, consumeQuota, refundQuota } from "../services/ai/aiAccess";
import { ClaudeCallError } from "../services/ai/claudeCredits";
import { generatePlaylist, MAX_PROMPT_LENGTH, songLine } from "../services/ai/playlistGenerator";
import { ensureAutoplayNext } from "../services/autoplay";
import { DiscordPlayerService } from "../services/discordPlayer";
import { PlayerPanelService } from "../services/playerPanel";
import { isStationId, RADIO_STATIONS, RadioRequest, shuffledSeeds, startRadio, STATION_IDS } from "../services/radio";
import { aiFailureMessage, aiQuotaMessage, aiTrialNote } from "../utils/aiReplies";
import { currentLocale, i18n } from "../utils/i18n";
import { runPlay } from "../utils/playFlow";
import play from "./play";

/**
 * /radio — endless music that keeps going after the queue runs out.
 *
 *   song:    related songs from one song or artist
 *   station: a genre station (lo-fi, rock, latin…)
 *   prompt:  AI DJ — Claude picks songs for a description ("rainy night jazz")
 *   none:    a radio from the song playing now
 */
export default {
  data: new SlashCommandBuilder()
    .setName("radio")
    .setDescription(i18n.__("radio.description"))
    .addStringOption((option) =>
      option.setName("song").setDescription(i18n.__("radio.optionSong")).setRequired(false).setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("station")
        .setDescription(i18n.__("radio.optionStation"))
        .setRequired(false)
        .addChoices(...STATION_IDS.map((id) => ({ name: `${RADIO_STATIONS[id].emoji} ${i18n.__(`radio.station.${id}`)}`, value: id })))
    )
    .addStringOption((option) =>
      option.setName("prompt").setDescription(i18n.__("radio.optionPrompt")).setRequired(false).setMaxLength(MAX_PROMPT_LENGTH)
    ),
  cooldown: 5,
  category: "music",
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  autocomplete: play.autocomplete,

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const song = interaction.options.getString("song")?.trim();
    const station = interaction.options.getString("station");
    const prompt = interaction.options.getString("prompt")?.trim();

    const chosen = [song, station, prompt].filter(Boolean).length;
    if (chosen > 1) {
      return interaction.reply({ content: `📻 ${i18n.__("radio.pickOne")}`, flags: MessageFlags.Ephemeral });
    }
    if (prompt) return startAiRadio(interaction, prompt);
    if (station && isStationId(station)) return startStation(interaction, station);
    if (song) return startSongRadio(interaction, song);
    return startFromCurrent(interaction);
  }
};

async function confirm(interaction: ChatInputCommandInteraction<"cached">, line: string) {
  await interaction.followUp({ content: line, allowedMentions: { parse: [] } }).catch(() => undefined);
}

async function begin(interaction: ChatInputCommandInteraction<"cached">, query: string, request: RadioRequest) {
  const result = await runPlay({ interaction, query, radio: request });
  if (!result) return null;
  startRadio(result.queue, request, result.track, interaction.user);
  void ensureAutoplayNext(result.queue).then((added) => added && PlayerPanelService.getInstance().refresh(result.queue));
  PlayerPanelService.getInstance().refresh(result.queue, true);
  return result;
}

async function startSongRadio(interaction: ChatInputCommandInteraction<"cached">, song: string) {
  const result = await begin(interaction, song, { kind: "song", label: song, startedBy: interaction.user.id });
  if (result) await confirm(interaction, `📻 ${i18n.__mf("radio.started", { title: result.track.title })}`);
}

async function startStation(interaction: ChatInputCommandInteraction<"cached">, id: (typeof STATION_IDS)[number]) {
  const [first, ...more] = shuffledSeeds(id);
  const name = i18n.__(`radio.station.${id}`);
  const result = await begin(interaction, first, { kind: "station", label: id, anchorQueries: more, startedBy: interaction.user.id });
  if (result) await confirm(interaction, `${RADIO_STATIONS[id].emoji} ${i18n.__mf("radio.stationStarted", { station: name })}`);
}

async function startFromCurrent(interaction: ChatInputCommandInteraction<"cached">) {
  const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
  const track = queue && !queue.deleted ? queue.currentTrack : null;
  if (!queue || !track) {
    return interaction.reply({ content: `📻 ${i18n.__("radio.noQueue")}`, flags: MessageFlags.Ephemeral });
  }
  const member = interaction.member as GuildMember;
  if (member.voice.channelId !== queue.channel?.id) {
    return interaction.reply({ content: `🔇 ${i18n.__("radio.notInVoice")}`, flags: MessageFlags.Ephemeral });
  }
  startRadio(queue, { kind: "song", label: track.title, startedBy: interaction.user.id }, track, interaction.user);
  void ensureAutoplayNext(queue).then((added) => added && PlayerPanelService.getInstance().refresh(queue));
  PlayerPanelService.getInstance().refresh(queue, true);
  return interaction.reply({ content: `📻 ${i18n.__mf("radio.started", { title: track.title })}`, allowedMentions: { parse: [] } });
}

/** AI DJ radio for a prompt (also behind /ai radio). */
export async function startAiRadio(interaction: ChatInputCommandInteraction<"cached">, prompt: string) {
  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    return interaction.reply({ content: `🔇 ${i18n.__("radio.notInVoice")}`, flags: MessageFlags.Ephemeral });
  }
  const access = await aiAccess(interaction.user.id, interaction.guildId);
  if (!(await consumeQuota("gen", interaction.guildId, access.daily))) {
    return interaction.reply(aiQuotaMessage(access));
  }

  await interaction.deferReply();
  const language = currentLocale();
  let playlist;
  try {
    playlist = await generatePlaylist({ prompt, count: AI_RADIO_BATCH, language, feature: "ai_radio" });
  } catch (error) {
    await refundQuota("gen", interaction.guildId);
    const reason = error instanceof ClaudeCallError ? error.reason : "error";
    if (reason === "error") console.error("[radio] AI radio failed:", error);
    return interaction.editReply({ content: aiFailureMessage(reason) });
  }

  const [first, ...rest] = playlist.tracks;
  const result = await begin(interaction, songLine(first), {
    kind: "ai",
    label: prompt,
    prompt,
    pending: rest,
    batchLimit: access.radioBatches,
    language,
    startedBy: interaction.user.id
  });
  if (!result) {
    await refundQuota("gen", interaction.guildId);
    return;
  }
  const lines = [`🤖 ${i18n.__mf("radio.aiStarted", { title: playlist.title })}`];
  if (playlist.description) lines.push(`-# ${playlist.description}`);
  const trial = await aiTrialNote(access, interaction.guildId);
  if (trial) lines.push(`-# ${trial}`);
  await confirm(interaction, lines.join("\n"));
}
