import { ButtonInteraction, CommandInteraction, InteractionReplyOptions, MessagePayload } from "discord.js";

export async function safeReply(
  interaction: CommandInteraction | ButtonInteraction, 
  content: string | InteractionReplyOptions | MessagePayload
) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(content);
    } else {
      await interaction.reply(content);
    }
  } catch (error) {
    console.error(error);
  }
}
