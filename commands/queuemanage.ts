import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import { useQueue } from "discord-player";
import { DiscordPlayerService } from "../services/discordPlayer";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("queuemanage")
    .setDescription(i18n.__("queuemanage.description"))
    // Remove duplicates
    .addSubcommand(sub => sub
      .setName("removedupes")
      .setDescription(i18n.__("queuemanage.removedupes.description")))
    // Sort queue
    .addSubcommand(sub => sub
      .setName("sort")
      .setDescription(i18n.__("queuemanage.sort.description"))
      .addStringOption(opt => opt.setName("by").setDescription(i18n.__("queuemanage.sort.optionBy")).setRequired(true)
        .addChoices(
          { name: i18n.__("queuemanage.sort.choice.title_asc"), value: "title_asc" },
          { name: i18n.__("queuemanage.sort.choice.title_desc"), value: "title_desc" },
          { name: i18n.__("queuemanage.sort.choice.duration_asc"), value: "duration_asc" },
          { name: i18n.__("queuemanage.sort.choice.duration_desc"), value: "duration_desc" }
        )))
    // Swap tracks
    .addSubcommand(sub => sub
      .setName("swap")
      .setDescription(i18n.__("queuemanage.swap.description"))
      .addIntegerOption(opt => opt.setName("position1").setDescription(i18n.__("queuemanage.swap.optionPosition1")).setRequired(true).setMinValue(1))
      .addIntegerOption(opt => opt.setName("position2").setDescription(i18n.__("queuemanage.swap.optionPosition2")).setRequired(true).setMinValue(1)))
    // Remove by user
    .addSubcommand(sub => sub
      .setName("removeuser")
      .setDescription(i18n.__("queuemanage.removeuser.description"))
      .addUserOption(opt => opt.setName("user").setDescription(i18n.__("queuemanage.removeuser.optionUser")).setRequired(true)))
    // Remove absent users
    .addSubcommand(sub => sub
      .setName("removeabsent")
      .setDescription(i18n.__("queuemanage.removeabsent.description")))
    // Remove last N
    .addSubcommand(sub => sub
      .setName("removelast")
      .setDescription(i18n.__("queuemanage.removelast.description"))
      .addIntegerOption(opt => opt.setName("count").setDescription(i18n.__("queuemanage.removelast.optionCount")).setRequired(true).setMinValue(1).setMaxValue(50)))
    // Remove range
    .addSubcommand(sub => sub
      .setName("removerange")
      .setDescription(i18n.__("queuemanage.removerange.description"))
      .addIntegerOption(opt => opt.setName("start").setDescription(i18n.__("queuemanage.removerange.optionStart")).setRequired(true).setMinValue(1))
      .addIntegerOption(opt => opt.setName("end").setDescription(i18n.__("queuemanage.removerange.optionEnd")).setRequired(true).setMinValue(1)))
    // Reverse queue
    .addSubcommand(sub => sub
      .setName("reverse")
      .setDescription(i18n.__("queuemanage.reverse.description"))),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const member = interaction.member as GuildMember;
    const subcommand = interaction.options.getSubcommand();

    if (!canModifyQueue(member)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    const hasDJ = await hasDJPermission(member);
    if (!hasDJ) {
      return interaction.editReply({ content: `❌ ${i18n.__("common.djRequired")}` }).catch(console.error);
    }

    const queue = useQueue(interaction.guildId!);

    if (!queue || queue.tracks.size === 0) {
      return interaction.editReply({ content: `❌ ${i18n.__("queuemanage.empty")}` }).catch(console.error);
    }

    const tracks = queue.tracks.toArray();

    switch (subcommand) {
      case "removedupes": {
        const seenUrls = new Set<string>();
        const indicesToRemove: number[] = [];
        const duplicateTitles: string[] = [];

        for (let i = 0; i < tracks.length; i++) {
          if (seenUrls.has(tracks[i].url)) {
            indicesToRemove.push(i);
            duplicateTitles.push(tracks[i].title);
          } else {
            seenUrls.add(tracks[i].url);
          }
        }

        if (indicesToRemove.length === 0) {
          return interaction.editReply({ content: `✅ ${i18n.__("queuemanage.removedupes.none")}` }).catch(console.error);
        }

        for (let i = indicesToRemove.length - 1; i >= 0; i--) {
          queue.removeTrack(indicesToRemove[i]);
        }

        const embed = new EmbedBuilder()
          .setTitle(`🗑️ ${i18n.__("queuemanage.removedupes.title")}`)
          .setDescription(i18n.__mf("queuemanage.removedupes.result", { count: indicesToRemove.length }))
          .setColor("#F8AA2A");

        return interaction.editReply({ embeds: [embed] }).catch(console.error);
      }

      case "sort": {
        const sortBy = interaction.options.getString("by", true);

        tracks.sort((a, b) => {
          switch (sortBy) {
            case "title_asc": return a.title.localeCompare(b.title);
            case "title_desc": return b.title.localeCompare(a.title);
            case "duration_asc": return (a.durationMS || 0) - (b.durationMS || 0);
            case "duration_desc": return (b.durationMS || 0) - (a.durationMS || 0);
            default: return 0;
          }
        });

        queue.tracks.clear();
        for (const track of tracks) {
          queue.tracks.add(track);
        }

        const sortLabels: Record<string, string> = {
          "title_asc": i18n.__("queuemanage.sort.label.title_asc"),
          "title_desc": i18n.__("queuemanage.sort.label.title_desc"),
          "duration_asc": i18n.__("queuemanage.sort.label.duration_asc"),
          "duration_desc": i18n.__("queuemanage.sort.label.duration_desc")
        };

        return interaction.editReply({
          content: `✅ ${i18n.__mf("queuemanage.sort.result", { label: sortLabels[sortBy] })}`
        }).catch(console.error);
      }

      case "swap": {
        const pos1 = interaction.options.getInteger("position1", true);
        const pos2 = interaction.options.getInteger("position2", true);

        if (pos1 === pos2) {
          return interaction.editReply({ content: `❌ ${i18n.__("queuemanage.swap.samePosition")}` }).catch(console.error);
        }

        if (pos1 > tracks.length || pos2 > tracks.length) {
          return interaction.editReply({ content: `❌ ${i18n.__mf("queuemanage.invalidPosition", { count: tracks.length })}` }).catch(console.error);
        }

        queue.swapTracks(pos1 - 1, pos2 - 1);

        return interaction.editReply({
          content: `✅ ${i18n.__mf("queuemanage.swap.result", { pos1, pos2 })}`
        }).catch(console.error);
      }

      case "removeuser": {
        const user = interaction.options.getUser("user", true);
        const toRemove: number[] = [];

        tracks.forEach((track, i) => {
          if (track.requestedBy?.id === user.id) {
            toRemove.push(i);
          }
        });

        if (toRemove.length === 0) {
          return interaction.editReply({ content: `❌ ${i18n.__mf("queuemanage.removeuser.none", { user: user.username })}` }).catch(console.error);
        }

        for (let i = toRemove.length - 1; i >= 0; i--) {
          queue.removeTrack(toRemove[i]);
        }

        return interaction.editReply({
          content: `✅ ${i18n.__mf("queuemanage.removeuser.result", { count: toRemove.length, user: user.username })}`
        }).catch(console.error);
      }

      case "removeabsent": {
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
          return interaction.editReply({ content: `❌ ${i18n.__("queuemanage.removeabsent.notInVoice")}` }).catch(console.error);
        }

        const voiceMembers = new Set(voiceChannel.members.map(m => m.id));
        const toRemove: number[] = [];

        tracks.forEach((track, i) => {
          if (track.requestedBy && !voiceMembers.has(track.requestedBy.id)) {
            toRemove.push(i);
          }
        });

        if (toRemove.length === 0) {
          return interaction.editReply({ content: `✅ ${i18n.__("queuemanage.removeabsent.none")}` }).catch(console.error);
        }

        for (let i = toRemove.length - 1; i >= 0; i--) {
          queue.removeTrack(toRemove[i]);
        }

        return interaction.editReply({
          content: `✅ ${i18n.__mf("queuemanage.removeabsent.result", { count: toRemove.length })}`
        }).catch(console.error);
      }

      case "removelast": {
        const count = interaction.options.getInteger("count", true);
        const actualCount = Math.min(count, tracks.length);

        for (let i = 0; i < actualCount; i++) {
          queue.removeTrack(queue.tracks.size - 1);
        }

        return interaction.editReply({
          content: `✅ ${i18n.__mf("queuemanage.removelast.result", { count: actualCount })}`
        }).catch(console.error);
      }

      case "removerange": {
        const start = interaction.options.getInteger("start", true);
        const end = interaction.options.getInteger("end", true);

        if (start > end) {
          return interaction.editReply({ content: `❌ ${i18n.__("queuemanage.removerange.startAfterEnd")}` }).catch(console.error);
        }

        if (start > tracks.length) {
          return interaction.editReply({ content: `❌ ${i18n.__mf("queuemanage.removerange.startTooHigh", { count: tracks.length })}` }).catch(console.error);
        }

        const actualEnd = Math.min(end, tracks.length);
        const count = actualEnd - start + 1;

        for (let i = actualEnd - 1; i >= start - 1; i--) {
          queue.removeTrack(i);
        }

        return interaction.editReply({
          content: `✅ ${i18n.__mf("queuemanage.removerange.result", { count, start, end: actualEnd })}`
        }).catch(console.error);
      }

      case "reverse": {
        const reversed = [...tracks].reverse();
        queue.tracks.clear();
        for (const track of reversed) {
          queue.tracks.add(track);
        }

        return interaction.editReply({ content: `✅ ${i18n.__("queuemanage.reverse.result")}` }).catch(console.error);
      }

      default:
        return interaction.editReply({ content: `❌ ${i18n.__("common.unknownSubcommand")}` }).catch(console.error);
    }
  }
};
