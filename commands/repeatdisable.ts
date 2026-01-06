import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { useQueue, QueueRepeatMode } from "discord-player";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

const repeatdisable: Command = {
    data: new SlashCommandBuilder()
        .setName("repeatdisable")
        .setDescription("Disable all repeat modes"),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const queue = useQueue(interaction.guildId!);
        
        if (!queue || !queue.isPlaying()) {
            await interaction.reply({ content: i18n.__("common.errorNoQueue"), ephemeral: true });
            return;
        }

        queue.setRepeatMode(QueueRepeatMode.OFF);
        
        const embed = new EmbedBuilder()
            .setTitle("Ì¥Å Repeat Disabled")
            .setDescription("All repeat modes have been disabled.")
            .setColor(0x95a5a6);
        
        await interaction.reply({ embeds: [embed] });
    }
};

export default repeatdisable;
