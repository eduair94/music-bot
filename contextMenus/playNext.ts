import { ApplicationCommandType, ContextMenuCommandBuilder, MessageContextMenuCommandInteraction } from "discord.js";
import { ContextMenuCommand } from "../interfaces/Command";
import { playFromMessage } from "./playInVoice";

const command: ContextMenuCommand = {
  data: new ContextMenuCommandBuilder().setName("Play next").setType(ApplicationCommandType.Message),
  cooldown: 2,
  execute: (interaction) => playFromMessage(interaction as MessageContextMenuCommandInteraction, true)
};

export default command;
