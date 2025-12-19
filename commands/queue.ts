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
import { bot } from "../index";
import { DiscordPlayerService } from "../services/discordPlayer";
import { Song } from "../structs/Song";
import { i18n } from "../utils/i18n";

interface TrackInfo {
  title: string;
  url: string;
}

export default {
  data: new SlashCommandBuilder().setName("queue").setDescription(i18n.__("queue.description")),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction) {
    // Try discord-player first (new fast system)
    const playerService = DiscordPlayerService.getInstance();
    const dpQueue = playerService.getQueue(interaction.guild!.id);
    
    let tracks: TrackInfo[] = [];
    
    if (dpQueue && dpQueue.tracks.size > 0) {
      // Get current track
      const currentTrack = dpQueue.currentTrack;
      if (currentTrack) {
        tracks.push({ title: currentTrack.title, url: currentTrack.url });
      }
      // Get queue tracks
      dpQueue.tracks.toArray().forEach((track: Track) => {
        tracks.push({ title: track.title, url: track.url });
      });
    } else {
      // Fall back to legacy queue system
      const queue = bot.queues.get(interaction.guild!.id);
      if (!queue || !queue.songs.length) {
        return interaction.reply({ content: i18n.__("queue.errorNotQueue") });
      }
      tracks = queue.songs.map((song: Song) => ({ title: song.title, url: song.url }));
    }

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

    await interaction.reply("⏳ Loading queue...");

    if (interaction.replied)
      await interaction.editReply({
        content: `**${i18n.__mf("queue.currentPage")} ${currentPage + 1}/${embeds.length}**`,
        embeds: [embeds[currentPage]],
        components: [row]
      });

    const queueEmbed = await interaction.fetchReply();

    const filter = (buttonInteraction: Interaction) =>
      buttonInteraction.isButton() && buttonInteraction.user.id === interaction.user.id;

    const collector = queueEmbed.createMessageComponentCollector({ filter, time: 60000 });

    const buttonHandlers = {
      next: async () => {
        if (currentPage >= embeds.length - 1) return;

        currentPage++;

        await interaction.editReply({
          content: `**${i18n.__mf("queue.currentPage", {
            page: currentPage + 1,
            length: embeds.length
          })}**`,
          embeds: [embeds[currentPage]],
          components: [row]
        });
      },
      previous: async () => {
        if (currentPage === 0) return;

        currentPage--;
        await interaction.editReply({
          content: `**${i18n.__mf("queue.currentPage", {
            page: currentPage + 1,
            length: embeds.length
          })}**`,
          embeds: [embeds[currentPage]],
          components: [row]
        });
      },
      stop: async () => {
        await interaction.editReply({
          components: []
        });

        collector.stop();
      }
    };

    collector.on("collect", async (buttonInteraction) => {
      buttonInteraction.deferUpdate();

      const handler = buttonHandlers[buttonInteraction.customId as keyof typeof buttonHandlers];

      if (handler) {
        await handler();
      }
    });

    collector.on("end", () => {
      queueEmbed
        .edit({
          components: []
        })
        .catch(console.error);
    });
  }
};

function generateQueueEmbed(interaction: CommandInteraction, songs: TrackInfo[]) {
  let embeds = [];
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
