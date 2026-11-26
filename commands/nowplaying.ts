import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService, QueueMetadata } from "../services/discordPlayer";
import { PlayerPanelService } from "../services/playerPanel";
import { i18n } from "../utils/i18n";

/** /nowplaying — bring the live player panel (with its controls) to the bottom of the chat. */
export default {
  data: new SlashCommandBuilder().setName("nowplaying").setDescription(i18n.__("nowplaying.description")),
  cooldown: 5,
  category: "info",
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
    const track = queue?.currentTrack ?? ((queue?.metadata || {}) as QueueMetadata).currentTrack;
    if (!queue || queue.deleted || !track) {
      return interaction.reply({ content: `🔇 ${i18n.__("player.nothingPlaying")}`, flags: MessageFlags.Ephemeral });
    }
    return PlayerPanelService.getInstance().repost(queue, interaction);
  }
};
