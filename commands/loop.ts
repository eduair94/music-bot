import { QueueRepeatMode } from "discord-player";
import { ChatInputCommandInteraction, GuildMember, MessageFlags, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { PlayerPanelService } from "../services/playerPanel";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

const MODES: Record<string, QueueRepeatMode> = {
  off: QueueRepeatMode.OFF,
  track: QueueRepeatMode.TRACK,
  queue: QueueRepeatMode.QUEUE
};

/** /loop [mode] — off / this song / the whole queue. Without a mode it cycles. */
export default {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription(i18n.__("loop.description"))
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription(i18n.__("loop.optionMode"))
        .addChoices(
          { name: i18n.__("loop.mode.off"), value: "off" },
          { name: i18n.__("loop.mode.track"), value: "track" },
          { name: i18n.__("loop.mode.queue"), value: "queue" }
        )
    ),
  category: "music",
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const member = interaction.member as GuildMember;
    const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
    if (!queue || queue.deleted || !queue.currentTrack) {
      return interaction.reply({ content: `🔇 ${i18n.__("player.nothingPlaying")}`, flags: MessageFlags.Ephemeral });
    }
    if (!canModifyQueue(member)) {
      return interaction.reply({ content: `🔇 ${i18n.__("player.notInVoice")}`, flags: MessageFlags.Ephemeral });
    }

    const requested = interaction.options.getString("mode");
    const order: number[] = [QueueRepeatMode.OFF, QueueRepeatMode.TRACK, QueueRepeatMode.QUEUE];
    const mode = requested ? MODES[requested] : order[(order.indexOf(queue.repeatMode) + 1) % order.length];
    queue.setRepeatMode(mode as any);
    PlayerPanelService.getInstance().refresh(queue, true);

    const label =
      mode === QueueRepeatMode.TRACK
        ? `🔂 ${i18n.__("player.loopTrack")}`
        : mode === QueueRepeatMode.QUEUE
          ? `🔁 ${i18n.__("player.loopQueue")}`
          : `➡️ ${i18n.__("player.loopOff")}`;
    return interaction.reply({ content: label });
  }
};
