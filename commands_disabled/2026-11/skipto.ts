import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

export default {
  data: new SlashCommandBuilder()
    .setName("skipto")
    .setDescription(i18n.__("skipto.description"))
    .addIntegerOption((option) =>
      option.setName("number").setDescription(i18n.__("skipto.args.number")).setRequired(true)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    // Defer reply immediately to prevent interaction timeout
    await interaction.deferReply().catch(console.error);
    
    const position = interaction.options.getInteger("number");
    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);

    if (!position || isNaN(position)) {
      return interaction.editReply({
        content: i18n.__mf("skipto.usageReply", { prefix: "/", name: "skipto" })
      }).catch(console.error);
    }

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
      return interaction.editReply({ content: i18n.__("skipto.errorNotQueue") }).catch(console.error);
    }

    const queueSize = queue.tracks.size + 1; // +1 for current track
    
    if (position < 1 || position > queueSize) {
      return interaction.editReply({ 
        content: i18n.__mf("skipto.errorNotValid", { length: queueSize })
      }).catch(console.error);
    }

    // Skip to position by removing tracks before it
    queue.node.skipTo(position - 1);

    return interaction.editReply({ 
      content: i18n.__mf("skipto.result", { author: interaction.user.id, arg: position }) 
    }).catch(console.error);
  }
};
