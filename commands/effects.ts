import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandSubcommandBuilder, EmbedBuilder } from "discord.js";
import { QueueFilters } from "discord-player";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

type FilterName = keyof QueueFilters;

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

    const currentFilters = queue.filters.ffmpeg.getFiltersEnabled();
    const user = `<@${interaction.user.id}>`;

    // Handle list subcommand
    if (subcommand === "list") {
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
      if (currentFilters.length > 0) {
        await queue.filters.ffmpeg.toggle(currentFilters as FilterName[]);
      }
      await logAction(interaction.guild!, interaction.user, "setting_change", () => i18n.__("actionLog.detail.effectsCleared"));
      return interaction.editReply({ content: `✅ ${i18n.__("effects.clear.done")}` }).catch(console.error);
    }

    // Map subcommand names to actual filter names
    const effectMap: Record<string, FilterName> = {
      "8d": "8D",
      "bassboost": "bassboost",
      "distortion": "earrape", // Using earrape as distortion-like effect
      "haas": "haas",
      "karaoke": "karaoke",
      "nightcore": "nightcore",
      "vaporwave": "vaporwave",
      "pulsator": "pulsator",
      "reverse": "reverse",
      "tremolo": "tremolo",
      "vibrato": "vibrato",
      "lofi": "lofi",
      "surrounding": "surrounding"
    };

    const filterName = effectMap[subcommand];
    if (!filterName) {
      return interaction.editReply({ content: `❌ ${i18n.__("effects.unknown")}` }).catch(console.error);
    }

    // Bass boost levels map to discord-player presets; only one is active at a time.
    if (subcommand === "bassboost") {
      const level = interaction.options.getString("level") || "medium";
      const presets: Record<string, FilterName> = { low: "bassboost_low" as FilterName, medium: "bassboost" as FilterName, high: "bassboost_high" as FilterName };
      const active = (["bassboost_low", "bassboost", "bassboost_high"] as FilterName[]).filter((f) => currentFilters.includes(f));
      const target = presets[level];
      const levelLabel = () => i18n.__(`effects.bassboost.level.${target ? level : "off"}`);

      if (active.length) await queue.filters.ffmpeg.toggle(active);
      if (level === "off" || !target) {
        await logAction(interaction.guild!, interaction.user, "setting_change", () => i18n.__mf("actionLog.detail.bassBoost", { level: levelLabel() }));
        return interaction.editReply({
          content: `🔊 ${active.length ? i18n.__mf("effects.bassboost.disabledBy", { user }) : i18n.__("effects.bassboost.alreadyOff")}`
        }).catch(console.error);
      }
      await queue.filters.ffmpeg.toggle([target]);
      await logAction(interaction.guild!, interaction.user, "setting_change", () => i18n.__mf("actionLog.detail.bassBoost", { level: levelLabel() }));
      return interaction.editReply({ content: `🔊 ${i18n.__mf("effects.bassboost.setBy", { level: levelLabel(), user })}` }).catch(console.error);
    }

    // Handle nightcore (mutually exclusive with vaporwave)
    if (subcommand === "nightcore") {
      const enabled = interaction.options.getBoolean("enabled");
      const isEnabled = currentFilters.includes("nightcore");
      const shouldEnable = enabled !== null ? enabled : !isEnabled;

      // If enabling nightcore, disable vaporwave first
      if (shouldEnable && currentFilters.includes("vaporwave")) {
        await queue.filters.ffmpeg.toggle(["vaporwave"]);
      }

      if (shouldEnable !== isEnabled) {
        await queue.filters.ffmpeg.toggle(["nightcore"]);
      }

      await logAction(interaction.guild!, interaction.user, "setting_change", () =>
        i18n.__mf(shouldEnable ? "actionLog.detail.effectOn" : "actionLog.detail.effectOff", { effect: effectName(subcommand) })
      );
      const emoji = shouldEnable ? "🎵" : "❌";
      const key = shouldEnable ? "effects.enabledBy" : "effects.disabledBy";
      return interaction.editReply({ content: `${emoji} ${i18n.__mf(key, { effect: effectName(subcommand), user })}` }).catch(console.error);
    }

    // Handle vaporwave (mutually exclusive with nightcore)
    if (subcommand === "vaporwave") {
      const enabled = interaction.options.getBoolean("enabled");
      const isEnabled = currentFilters.includes("vaporwave");
      const shouldEnable = enabled !== null ? enabled : !isEnabled;

      // If enabling vaporwave, disable nightcore first
      if (shouldEnable && currentFilters.includes("nightcore")) {
        await queue.filters.ffmpeg.toggle(["nightcore"]);
      }

      if (shouldEnable !== isEnabled) {
        await queue.filters.ffmpeg.toggle(["vaporwave"]);
      }

      await logAction(interaction.guild!, interaction.user, "setting_change", () =>
        i18n.__mf(shouldEnable ? "actionLog.detail.effectOn" : "actionLog.detail.effectOff", { effect: effectName(subcommand) })
      );
      const emoji = shouldEnable ? "🌴" : "❌";
      const key = shouldEnable ? "effects.enabledBy" : "effects.disabledBy";
      return interaction.editReply({ content: `${emoji} ${i18n.__mf(key, { effect: effectName(subcommand), user })}` }).catch(console.error);
    }

    // Generic toggle for other effects
    const enabled = interaction.options.getBoolean("enabled");
    const isEnabled = currentFilters.includes(filterName);
    const shouldEnable = enabled !== null ? enabled : !isEnabled;

    if (shouldEnable !== isEnabled) {
      await queue.filters.ffmpeg.toggle([filterName]);
    }

    await logAction(interaction.guild!, interaction.user, "setting_change", () =>
      i18n.__mf(shouldEnable ? "actionLog.detail.effectOn" : "actionLog.detail.effectOff", { effect: effectName(subcommand) })
    );

    const emojiMap: Record<string, string> = {
      "8D": "🎧",
      "haas": "🔊",
      "karaoke": "🎤",
      "pulsator": "💫",
      "reverse": "⏪",
      "tremolo": "🎵",
      "vibrato": "🎶",
      "lofi": "📻",
      "surrounding": "🔉",
      "earrape": "💥"
    };

    const emoji = shouldEnable ? (emojiMap[filterName] || "✅") : "❌";
    const key = shouldEnable ? "effects.enabledBy" : "effects.disabledBy";
    return interaction.editReply({
      content: `${emoji} ${i18n.__mf(key, { effect: `**${effectName(subcommand)}**`, user })}`
    }).catch(console.error);
  }
};
