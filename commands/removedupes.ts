import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember, 
  SlashCommandBuilder 
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("removedupes")
    .setDescription(i18n.__("removedupes.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("removedupes.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue || queue.tracks.size === 0) {
      return interaction.reply({
        content: i18n.__("removedupes.noQueue"),
        ephemeral: true
      });
    }

    const tracks = queue.tracks.toArray();
    const seenUrls = new Set<string>();
    const indicesToRemove: number[] = [];
    const duplicateTitles: string[] = [];
    
    // Find duplicates
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (seenUrls.has(track.url)) {
        indicesToRemove.push(i);
        duplicateTitles.push(track.title);
      } else {
        seenUrls.add(track.url);
      }
    }

    if (indicesToRemove.length === 0) {
      return interaction.reply({
        content: i18n.__("removedupes.noDupes"),
        ephemeral: true
      });
    }

    // Remove duplicates (in reverse order to maintain correct indices)
    for (let i = indicesToRemove.length - 1; i >= 0; i--) {
      queue.removeTrack(indicesToRemove[i]);
    }

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("removedupes.title"))
      .setDescription(i18n.__mf("removedupes.success", { 
        count: indicesToRemove.length 
      }))
      .setColor("#F8AA2A")
      .addFields({
        name: i18n.__("removedupes.removedField"),
        value: duplicateTitles.slice(0, 10).join("\n") + 
          (duplicateTitles.length > 10 ? `\n... and ${duplicateTitles.length - 10} more` : "")
      });

    return interaction.reply({ embeds: [embed] });
  }
};
