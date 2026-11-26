import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("next")
    .setDescription(i18n.__("next.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = useQueue(interaction.guildId!);
    
    if (!queue || !queue.currentTrack) {
      return interaction.reply({
        content: i18n.__("next.noQueue"),
        ephemeral: true
      });
    }

    const currentTrack = queue.currentTrack;
    
    try {
      queue.node.skip();
      
      const nextTrack = queue.tracks.at(0);
      if (nextTrack) {
        return interaction.reply(
          i18n.__mf("next.skippedTo", { 
            skipped: currentTrack.title,
            next: nextTrack.title 
          })
        );
      } else {
        return interaction.reply(
          i18n.__mf("next.skippedLast", { title: currentTrack.title })
        );
      }
    } catch (error) {
      console.error("[next] Error:", error);
      return interaction.reply({
        content: i18n.__("common.errorCommand"),
        ephemeral: true
      });
    }
  }
};
