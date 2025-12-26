import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("move")
    .setDescription(i18n.__("move.description"))
    .addIntegerOption((option) =>
      option.setName("movefrom").setDescription(i18n.__("move.args.movefrom")).setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName("moveto").setDescription(i18n.__("move.args.moveto")).setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    // Defer reply immediately to prevent interaction timeout
    await interaction.deferReply().catch(console.error);
    
    const moveFrom = interaction.options.getInteger("movefrom");
    const moveTo = interaction.options.getInteger("moveto");
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!canModifyQueue(guildMember!)) {
      return interaction.editReply({ content: i18n.__("common.errorNotChannel") }).catch(console.error);
    }

    // Check DJ permission
    const hasDJ = await hasDJPermission(guildMember as GuildMember);
    if (!hasDJ) {
      return interaction.editReply({ 
        content: "❌ You need the DJ role to use this command."
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    const queue = playerService.getQueue(interaction.guild!.id);

    if (!queue) {
      return interaction.editReply({ content: i18n.__("move.errorNotQueue") }).catch(console.error);
    }

    if (!moveFrom || !moveTo) {
      return interaction.editReply({ content: i18n.__mf("move.usagesReply", { prefix: "/" }) }).catch(console.error);
    }

    const tracks = queue.tracks.toArray();
    
    if (isNaN(moveFrom) || moveFrom < 1 || moveFrom > tracks.length) {
      return interaction.editReply({ content: i18n.__mf("move.usagesReply", { prefix: "/" }) }).catch(console.error);
    }

    const track = tracks[moveFrom - 1];
    
    // Move the track using discord-player's built-in method
    queue.moveTrack(moveFrom - 1, moveTo - 1);

    return interaction.editReply({
      content: i18n.__mf("move.result", {
        author: interaction.user.id,
        title: track.title,
        index: moveTo
      })
    }).catch(console.error);
  }
};
