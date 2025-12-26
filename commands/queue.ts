import { Track } from "discord-player";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  CommandInteraction,
  EmbedBuilder,
  Interaction,
  SlashCommandBuilder
} from "discord.js";
import { DiscordPlayerService, QueueMetadata } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

interface TrackInfo {
  title: string;
  url: string;
}

export default {
  data: new SlashCommandBuilder().setName("queue").setDescription(i18n.__("queue.description")),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue) {
      return interaction.reply({ content: i18n.__("queue.errorNotQueue") });
    }

    const tracks: TrackInfo[] = [];
    
    // Get current track (use queue.metadata.currentTrack as fallback)
    let currentTrack: Track | null | undefined = queue.currentTrack;
    if (!currentTrack && queue.metadata) {
      const metadata = queue.metadata as QueueMetadata;
      currentTrack = metadata.currentTrack;
    }
    if (currentTrack) {
      tracks.push({ title: currentTrack.title, url: currentTrack.url });
    }
    
    // Get queue tracks
    queue.tracks.toArray().forEach((track: Track) => {
      tracks.push({ title: track.title, url: track.url });
    });

    if (tracks.length === 0) {
      return interaction.reply({ content: i18n.__("queue.errorNotQueue") });
    }

    let currentPage = 0;
    const embeds = generateQueueEmbed(interaction, tracks);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("previous").setLabel("⬅️").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("stop").setLabel("⏹").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("next").setLabel("➡️").setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: `**${i18n.__mf("queue.currentPage")} ${currentPage + 1}/${embeds.length}**`,
      embeds: [embeds[currentPage]],
      components: [row]
    });

    const queueEmbed = await interaction.fetchReply();

    const filter = (buttonInteraction: Interaction) =>
      buttonInteraction.isButton() && buttonInteraction.user.id === interaction.user.id;

    const collector = queueEmbed.createMessageComponentCollector({ filter, time: 60000 });

    collector.on("collect", async (buttonInteraction) => {
      buttonInteraction.deferUpdate();

      if (buttonInteraction.customId === "next" && currentPage < embeds.length - 1) {
        currentPage++;
      } else if (buttonInteraction.customId === "previous" && currentPage > 0) {
        currentPage--;
      } else if (buttonInteraction.customId === "stop") {
        await interaction.editReply({ components: [] });
        collector.stop();
        return;
      }

      await interaction.editReply({
        content: `**${i18n.__mf("queue.currentPage", { page: currentPage + 1, length: embeds.length })}**`,
        embeds: [embeds[currentPage]],
        components: [row]
      });
    });

    collector.on("end", () => {
      queueEmbed.edit({ components: [] }).catch(console.error);
    });
  }
};

function generateQueueEmbed(interaction: CommandInteraction, songs: TrackInfo[]) {
  const embeds = [];
  let k = 10;

  for (let i = 0; i < songs.length; i += 10) {
    const current = songs.slice(i, k);
    let j = i;
    k += 10;

    const info = current.map((track) => `${++j} - [${track.title}](${track.url})`).join("\n");

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("queue.embedTitle"))
      .setThumbnail(interaction.guild?.iconURL()!)
      .setColor("#F8AA2A")
      .setDescription(i18n.__mf("queue.embedCurrentSong", { title: songs[0].title, url: songs[0].url, info: info }))
      .setTimestamp();
    embeds.push(embed);
  }

  return embeds;
}
