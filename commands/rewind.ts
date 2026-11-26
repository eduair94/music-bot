import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("rewind")
    .setDescription(i18n.__("rewind.description"))
    .addIntegerOption((option) =>
      option
        .setName("seconds")
        .setDescription(i18n.__("rewind.optionSeconds"))
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(300)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply().catch(console.error);
    
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    const hasDJ = await hasDJPermission(guildMember as GuildMember);
    if (!hasDJ) {
      return interaction.editReply({ 
        content: `❌ ${i18n.__("common.djRequired")}`
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue || !queue.currentTrack) {
      return interaction.editReply({ content: i18n.__("rewind.errorNotQueue") }).catch(console.error);
    }

    const seconds = interaction.options.getInteger("seconds") || 10;
    // streamTime resets on every seek/filter change; the timestamp is the real position.
    const currentPosition = queue.node.getTimestamp()?.current.value ?? queue.node.playbackTime;
    const newPosition = Math.max(currentPosition - (seconds * 1000), 0);

    await queue.node.seek(newPosition);
    await logAction(interaction.guild!, interaction.user, "rewind", `${seconds}s`);
    
    return interaction.editReply({ 
      content: i18n.__mf("rewind.result", { 
        seconds: seconds, 
        position: formatTime(newPosition),
        author: interaction.user.id 
      })
    }).catch(console.error);
  }
};
