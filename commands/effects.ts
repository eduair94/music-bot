import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, SlashCommandSubcommandBuilder, EmbedBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { BASS_PRESETS, BassLevel, clearEffects, EFFECT_FILTERS, enabledFilters, setBassBoost, setEffect } from "../services/effects";
import { logAction } from "../utils/actionLog";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

// Valid filter names from discord-player QueueFilters interface
// Available: bassboost_low, bassboost, bassboost_high, 8D, vaporwave, nightcore,
// phaser, tremolo, vibrato, reverse, treble, normalizer, normalizer2, surrounding,
// pulsator, subboost, karaoke, flanger, gate, haas, mcompand, mono, mstlr, mstrr,
// compressor, expander, softlimiter, chorus, chorus2d, chorus3d, fadein, dim, earrape, lofi, silenceremove

/** A subcommand with one optional `enabled` boolean (every effect but bass boost). */
const toggle = (name: string) => (sub: SlashCommandSubcommandBuilder) => sub
  .setName(name)
  .setDescription(i18n.__(`effects.${name}.description`))
  .addBooleanOption(opt => opt.setName("enabled").setDescription(i18n.__("effects.optionEnabled")).setRequired(false));

const builder = new SlashCommandBuilder()
  .setName("effects")
  .setDescription(i18n.__("effects.description"))
  // 8D Audio
  .addSubcommand(toggle("8d"))
  // Bass Boost
  .addSubcommand(sub => sub
    .setName("bassboost")
    .setDescription(i18n.__("effects.bassboost.description"))
    .addStringOption(opt => opt.setName("level").setDescription(i18n.__("effects.bassboost.optionLevel"))
      .addChoices(
        { name: i18n.__("effects.bassboost.level.off"), value: "off" },
        { name: i18n.__("effects.bassboost.level.low"), value: "low" },
        { name: i18n.__("effects.bassboost.level.medium"), value: "medium" },
        { name: i18n.__("effects.bassboost.level.high"), value: "high" }
      )))
  // Distortion (using earrape as a distortion-like effect)
  .addSubcommand(toggle("distortion"))
  // Haas (spatial audio effect)
  .addSubcommand(toggle("haas"))
  // Karaoke
  .addSubcommand(toggle("karaoke"))
  // Nightcore
  .addSubcommand(toggle("nightcore"))
  // Vaporwave
  .addSubcommand(toggle("vaporwave"))
  // Pulsator
  .addSubcommand(toggle("pulsator"))
  // Reverse
  .addSubcommand(toggle("reverse"))
  // Tremolo
  .addSubcommand(toggle("tremolo"))
  // Vibrato
  .addSubcommand(toggle("vibrato"))
  // Lofi
  .addSubcommand(toggle("lofi"))
  // Surrounding
  .addSubcommand(toggle("surrounding"))
  // List active effects
  .addSubcommand(sub => sub
    .setName("list")
    .setDescription(i18n.__("effects.list.description")))
  // Clear all effects
  .addSubcommand(sub => sub
    .setName("clear")
    .setDescription(i18n.__("effects.clear.description")));

/** Display name of an effect subcommand, e.g. "Karaoke". */
function effectName(subcommand: string): string {
  return i18n.__(`effects.${subcommand}.name`);
}

const EMOJI: Record<string, string> = {
  "8d": "🎧",
  haas: "🔊",
  karaoke: "🎤",
  nightcore: "🎵",
  vaporwave: "🌴",
  pulsator: "💫",
  reverse: "⏪",
  tremolo: "🎵",
  vibrato: "🎶",
  lofi: "📻",
  surrounding: "🔉",
  distortion: "💥"
};

export default {
  data: builder,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }


    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);

    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: `❌ ${i18n.__("effects.nothingPlaying")}` }).catch(console.error);
    }

    const user = `<@${interaction.user.id}>`;

    // Handle list subcommand
    if (subcommand === "list") {
      const currentFilters = enabledFilters(queue);
      const embed = new EmbedBuilder()
        .setTitle(`🎛️ ${i18n.__("effects.list.title")}`)
        .setColor(0x3498db)
        .setDescription(currentFilters.length > 0
          ? currentFilters.map(f => `• ${f}`).join("\n")
          : i18n.__("effects.list.empty"));
      return interaction.editReply({ embeds: [embed] }).catch(console.error);
    }

    // Handle clear subcommand
    if (subcommand === "clear") {
      await clearEffects(queue);
      await logAction(interaction.guild!, interaction.user, "setting_change", () => i18n.__("actionLog.detail.effectsCleared"));
      return interaction.editReply({ content: `✅ ${i18n.__("effects.clear.done")}` }).catch(console.error);
    }

    if (!EFFECT_FILTERS[subcommand]) {
      return interaction.editReply({ content: `❌ ${i18n.__("effects.unknown")}` }).catch(console.error);
    }

    // Bass boost levels map to discord-player presets; only one is active at a time.
    if (subcommand === "bassboost") {
      const raw = interaction.options.getString("level") || "medium";
      const level: BassLevel = raw in BASS_PRESETS ? (raw as BassLevel) : "off";
      const levelLabel = () => i18n.__(`effects.bassboost.level.${level}`);
      const { wasActive } = await setBassBoost(queue, level);
      await logAction(interaction.guild!, interaction.user, "setting_change", () => i18n.__mf("actionLog.detail.bassBoost", { level: levelLabel() }));
      if (level === "off") {
        return interaction.editReply({
          content: `🔊 ${wasActive ? i18n.__mf("effects.bassboost.disabledBy", { user }) : i18n.__("effects.bassboost.alreadyOff")}`
        }).catch(console.error);
      }
      return interaction.editReply({ content: `🔊 ${i18n.__mf("effects.bassboost.setBy", { level: levelLabel(), user })}` }).catch(console.error);
    }

    // Toggle (nightcore and vaporwave stay mutually exclusive)
    const shouldEnable = await setEffect(queue, subcommand, interaction.options.getBoolean("enabled"));

    await logAction(interaction.guild!, interaction.user, "setting_change", () =>
      i18n.__mf(shouldEnable ? "actionLog.detail.effectOn" : "actionLog.detail.effectOff", { effect: effectName(subcommand) })
    );

    const emoji = shouldEnable ? (EMOJI[subcommand] || "✅") : "❌";
    const key = shouldEnable ? "effects.enabledBy" : "effects.disabledBy";
    // Nightcore and vaporwave were announced without bold before; keep that.
    const label = subcommand === "nightcore" || subcommand === "vaporwave" ? effectName(subcommand) : `**${effectName(subcommand)}**`;
    return interaction.editReply({ content: `${emoji} ${i18n.__mf(key, { effect: label, user })}` }).catch(console.error);
  }
};
