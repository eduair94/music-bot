import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("jump")
    .setDescription(i18n.__("jump.description"))
    .addIntegerOption((option) =>
      option
        .setName("position")
        .setDescription("Queue position to jump to")
        .setRequired(true)
        .setMinValue(1)
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
        content: "❌ You need the DJ role to use this command."
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);
    
    if (!queue || queue.tracks.size === 0) {
      return interaction.editReply({ content: i18n.__("jump.errorNotQueue") }).catch(console.error);
    }

    const position = interaction.options.getInteger("position", true);
    
    if (position > queue.tracks.size) {
      return interaction.editReply({ 
        content: i18n.__mf("jump.errorInvalidPosition", { max: queue.tracks.size })
      }).catch(console.error);
    }

    // Get the track at the position
    const track = queue.tracks.at(position - 1);
    if (!track) {
      return interaction.editReply({ content: i18n.__("jump.errorNotFound") }).catch(console.error);
    }

    // Remove tracks before the target position and skip current
    for (let i = 0; i < position - 1; i++) {
      queue.tracks.removeOne((t) => t === queue.tracks.at(0));
    }
    queue.node.skip();
    
    await logAction(interaction.guild!, interaction.user, "jump", track.title);
    
    return interaction.editReply({ 
      content: i18n.__mf("jump.result", { title: track.title, author: interaction.user.id })
    }).catch(console.error);
  }
};
