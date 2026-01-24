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
    .setDescription("Advanced queue management")
    // Remove duplicates
    .addSubcommand(sub => sub
      .setName("removedupes")
      .setDescription("Remove duplicate tracks from queue"))
    // Sort queue
    .addSubcommand(sub => sub
      .setName("sort")
      .setDescription("Sort the queue")
      .addStringOption(opt => opt.setName("by").setDescription("Sort by").setRequired(true)
        .addChoices(
          { name: "Title (A-Z)", value: "title_asc" },
          { name: "Title (Z-A)", value: "title_desc" },
          { name: "Duration (Short)", value: "duration_asc" },
          { name: "Duration (Long)", value: "duration_desc" }
        )))
    // Swap tracks
    .addSubcommand(sub => sub
      .setName("swap")
      .setDescription("Swap two tracks in the queue")
      .addIntegerOption(opt => opt.setName("position1").setDescription("First position").setRequired(true).setMinValue(1))
      .addIntegerOption(opt => opt.setName("position2").setDescription("Second position").setRequired(true).setMinValue(1)))
    // Remove by user
    .addSubcommand(sub => sub
      .setName("removeuser")
      .setDescription("Remove all tracks from a user")
      .addUserOption(opt => opt.setName("user").setDescription("User to remove tracks from").setRequired(true)))
    // Remove absent users
    .addSubcommand(sub => sub
      .setName("removeabsent")
      .setDescription("Remove tracks from users not in voice"))
    // Remove last N
    .addSubcommand(sub => sub
      .setName("removelast")
      .setDescription("Remove last N tracks")
      .addIntegerOption(opt => opt.setName("count").setDescription("Number to remove").setRequired(true).setMinValue(1).setMaxValue(50)))
    // Remove range
    .addSubcommand(sub => sub
      .setName("removerange")
      .setDescription("Remove tracks in a range")
      .addIntegerOption(opt => opt.setName("start").setDescription("Start position").setRequired(true).setMinValue(1))
      .addIntegerOption(opt => opt.setName("end").setDescription("End position").setRequired(true).setMinValue(1)))
    // Reverse queue
    .addSubcommand(sub => sub
      .setName("reverse")
      .setDescription("Reverse the queue order")),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);

    const member = interaction.member as GuildMember;
    const subcommand = interaction.options.getSubcommand();

    if (!canModifyQueue(member)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    const hasDJ = await hasDJPermission(member);
    if (!hasDJ) {
      return interaction.editReply({ content: "❌ You need the DJ role to use this command." }).catch(console.error);
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue || queue.tracks.size === 0) {
      return interaction.editReply({ content: "❌ The queue is empty." }).catch(console.error);
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
          return interaction.editReply({ content: "✅ No duplicates found!" }).catch(console.error);
        }

        for (let i = indicesToRemove.length - 1; i >= 0; i--) {
          queue.removeTrack(indicesToRemove[i]);
        }

        const embed = new EmbedBuilder()
          .setTitle("🗑️ Duplicates Removed")
          .setDescription(`Removed **${indicesToRemove.length}** duplicate tracks`)
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
          "title_asc": "Title (A-Z)",
          "title_desc": "Title (Z-A)",
          "duration_asc": "Duration (Shortest)",
          "duration_desc": "Duration (Longest)"
        };

        return interaction.editReply({ 
          content: `✅ Queue sorted by **${sortLabels[sortBy]}**` 
        }).catch(console.error);
      }

      case "swap": {
        const pos1 = interaction.options.getInteger("position1", true);
        const pos2 = interaction.options.getInteger("position2", true);
        
        if (pos1 === pos2) {
          return interaction.editReply({ content: "❌ Positions must be different." }).catch(console.error);
        }

        if (pos1 > tracks.length || pos2 > tracks.length) {
          return interaction.editReply({ content: `❌ Invalid position. Queue has ${tracks.length} tracks.` }).catch(console.error);
        }

        queue.swapTracks(pos1 - 1, pos2 - 1);

        return interaction.editReply({ 
          content: `✅ Swapped tracks at positions **${pos1}** and **${pos2}**` 
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
          return interaction.editReply({ content: `❌ No tracks found from ${user.username}.` }).catch(console.error);
        }

        for (let i = toRemove.length - 1; i >= 0; i--) {
          queue.removeTrack(toRemove[i]);
        }

        return interaction.editReply({ 
          content: `✅ Removed **${toRemove.length}** tracks from ${user.username}` 
        }).catch(console.error);
      }

      case "removeabsent": {
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
          return interaction.editReply({ content: "❌ You must be in a voice channel." }).catch(console.error);
        }

        const voiceMembers = new Set(voiceChannel.members.map(m => m.id));
        const toRemove: number[] = [];
        
        tracks.forEach((track, i) => {
          if (track.requestedBy && !voiceMembers.has(track.requestedBy.id)) {
            toRemove.push(i);
          }
        });

        if (toRemove.length === 0) {
          return interaction.editReply({ content: "✅ All track requesters are in the voice channel." }).catch(console.error);
        }

        for (let i = toRemove.length - 1; i >= 0; i--) {
          queue.removeTrack(toRemove[i]);
        }

        return interaction.editReply({ 
          content: `✅ Removed **${toRemove.length}** tracks from absent users` 
        }).catch(console.error);
      }

      case "removelast": {
        const count = interaction.options.getInteger("count", true);
        const actualCount = Math.min(count, tracks.length);
        
        for (let i = 0; i < actualCount; i++) {
          queue.removeTrack(queue.tracks.size - 1);
        }

        return interaction.editReply({ 
          content: `✅ Removed last **${actualCount}** tracks` 
        }).catch(console.error);
      }

      case "removerange": {
        const start = interaction.options.getInteger("start", true);
        const end = interaction.options.getInteger("end", true);
        
        if (start > end) {
          return interaction.editReply({ content: "❌ Start must be less than or equal to end." }).catch(console.error);
        }

        if (start > tracks.length) {
          return interaction.editReply({ content: `❌ Start position exceeds queue length (${tracks.length}).` }).catch(console.error);
        }

        const actualEnd = Math.min(end, tracks.length);
        const count = actualEnd - start + 1;

        for (let i = actualEnd - 1; i >= start - 1; i--) {
          queue.removeTrack(i);
        }

        return interaction.editReply({ 
          content: `✅ Removed **${count}** tracks (positions ${start}-${actualEnd})` 
        }).catch(console.error);
      }

      case "reverse": {
        const reversed = [...tracks].reverse();
        queue.tracks.clear();
        for (const track of reversed) {
          queue.tracks.add(track);
        }

        return interaction.editReply({ content: "✅ Queue order reversed" }).catch(console.error);
      }

      default:
        return interaction.editReply({ content: "❌ Unknown subcommand." }).catch(console.error);
    }
  }
};
