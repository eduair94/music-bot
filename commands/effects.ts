import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { QueueFilters } from "discord-player";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

type FilterName = keyof QueueFilters;

// Valid filter names from discord-player QueueFilters interface
// Available: bassboost_low, bassboost, bassboost_high, 8D, vaporwave, nightcore,
// phaser, tremolo, vibrato, reverse, treble, normalizer, normalizer2, surrounding,
// pulsator, subboost, karaoke, flanger, gate, haas, mcompand, mono, mstlr, mstrr,
// compressor, expander, softlimiter, chorus, chorus2d, chorus3d, fadein, dim, earrape, lofi, silenceremove

export default {
  data: new SlashCommandBuilder()
    .setName("effects")
    .setDescription("Manage audio effects")
    // 8D Audio
    .addSubcommand(sub => sub
      .setName("8d")
      .setDescription("Apply 8D audio effect (rotates sound)")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Bass Boost
    .addSubcommand(sub => sub
      .setName("bassboost")
      .setDescription("Apply bass boost effect")
      .addStringOption(opt => opt.setName("level").setDescription("Bass level")
        .addChoices(
          { name: "Off", value: "off" },
          { name: "Low", value: "low" },
          { name: "Medium", value: "medium" },
          { name: "High", value: "high" }
        )))
    // Distortion (using earrape as a distortion-like effect)
    .addSubcommand(sub => sub
      .setName("distortion")
      .setDescription("Apply distortion effect")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Haas (spatial audio effect)
    .addSubcommand(sub => sub
      .setName("haas")
      .setDescription("Apply haas effect (spatial audio)")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Karaoke
    .addSubcommand(sub => sub
      .setName("karaoke")
      .setDescription("Reduce vocals (karaoke mode)")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Nightcore
    .addSubcommand(sub => sub
      .setName("nightcore")
      .setDescription("Apply nightcore effect (higher pitch + speed)")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Vaporwave
    .addSubcommand(sub => sub
      .setName("vaporwave")
      .setDescription("Apply vaporwave effect (lower pitch + speed)")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Pulsator
    .addSubcommand(sub => sub
      .setName("pulsator")
      .setDescription("Apply pulsator effect")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Reverse
    .addSubcommand(sub => sub
      .setName("reverse")
      .setDescription("Reverse audio playback")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Tremolo
    .addSubcommand(sub => sub
      .setName("tremolo")
      .setDescription("Apply tremolo effect")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Vibrato
    .addSubcommand(sub => sub
      .setName("vibrato")
      .setDescription("Apply vibrato effect")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Lofi
    .addSubcommand(sub => sub
      .setName("lofi")
      .setDescription("Apply lofi effect")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // Surrounding
    .addSubcommand(sub => sub
      .setName("surrounding")
      .setDescription("Apply surrounding sound effect")
      .addBooleanOption(opt => opt.setName("enabled").setDescription("Enable or disable").setRequired(false)))
    // List active effects
    .addSubcommand(sub => sub
      .setName("list")
      .setDescription("Show active effects"))
    // Clear all effects
    .addSubcommand(sub => sub
      .setName("clear")
      .setDescription("Clear all effects")),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);
    const subcommand = interaction.options.getSubcommand();

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    const hasDJ = await hasDJPermission(guildMember as GuildMember);
    if (!hasDJ) {
      return interaction.editReply({ content: "❌ You need the DJ role to use this command." }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);

    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: "❌ No music is currently playing." }).catch(console.error);
    }

    const currentFilters = queue.filters.ffmpeg.getFiltersEnabled();

    // Handle list subcommand
    if (subcommand === "list") {
      const embed = new EmbedBuilder()
        .setTitle("🎛️ Active Effects")
        .setColor(0x3498db)
        .setDescription(currentFilters.length > 0 
          ? currentFilters.map(f => `• ${f}`).join("\n") 
          : "No effects active");
      return interaction.editReply({ embeds: [embed] }).catch(console.error);
    }

    // Handle clear subcommand
    if (subcommand === "clear") {
      if (currentFilters.length > 0) {
        await queue.filters.ffmpeg.toggle(currentFilters as FilterName[]);
      }
      await logAction(interaction.guild!, interaction.user, "setting_change", "Effects cleared");
      return interaction.editReply({ content: "✅ All effects cleared." }).catch(console.error);
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
      return interaction.editReply({ content: "❌ Unknown effect." }).catch(console.error);
    }

    // Handle bassboost with levels
    if (subcommand === "bassboost") {
      const level = interaction.options.getString("level") || "medium";
      const isEnabled = currentFilters.includes("bassboost");
      
      if (level === "off" && isEnabled) {
        await queue.filters.ffmpeg.toggle(["bassboost"]);
        await logAction(interaction.guild!, interaction.user, "setting_change", "Bass boost Off");
        return interaction.editReply({ content: `🔊 Bass boost disabled by <@${interaction.user.id}>` }).catch(console.error);
      } else if (level !== "off") {
        if (!isEnabled) await queue.filters.ffmpeg.toggle(["bassboost"]);
        await logAction(interaction.guild!, interaction.user, "setting_change", `Bass boost ${level}`);
        return interaction.editReply({ content: `🔊 Bass boost set to **${level}** by <@${interaction.user.id}>` }).catch(console.error);
      }
      return interaction.editReply({ content: "🔊 Bass boost is already off." }).catch(console.error);
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

      const status = shouldEnable ? "enabled" : "disabled";
      await logAction(interaction.guild!, interaction.user, "setting_change", `Nightcore ${status}`);
      const emoji = shouldEnable ? "🎵" : "❌";
      return interaction.editReply({ content: `${emoji} Nightcore effect ${status} by <@${interaction.user.id}>` }).catch(console.error);
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

      const status = shouldEnable ? "enabled" : "disabled";
      await logAction(interaction.guild!, interaction.user, "setting_change", `Vaporwave ${status}`);
      const emoji = shouldEnable ? "🌴" : "❌";
      return interaction.editReply({ content: `${emoji} Vaporwave effect ${status} by <@${interaction.user.id}>` }).catch(console.error);
    }

    // Generic toggle for other effects
    const enabled = interaction.options.getBoolean("enabled");
    const isEnabled = currentFilters.includes(filterName);
    const shouldEnable = enabled !== null ? enabled : !isEnabled;

    if (shouldEnable !== isEnabled) {
      await queue.filters.ffmpeg.toggle([filterName]);
    }

    const status = shouldEnable ? "enabled" : "disabled";
    await logAction(interaction.guild!, interaction.user, "setting_change", `${filterName} ${status}`);
    
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
    const displayName = subcommand === "distortion" ? "Distortion" : filterName;
    return interaction.editReply({ 
      content: `${emoji} **${displayName}** effect ${status} by <@${interaction.user.id}>` 
    }).catch(console.error);
  }
};
