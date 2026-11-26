import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { Command } from "../interfaces/Command";
import { useQueue, QueueRepeatMode } from "discord-player";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";

const repeat: Command = {
    data: new SlashCommandBuilder()
        .setName("repeat")
        .setDescription("Control repeat modes for the queue")
        .addSubcommand(sub => sub.setName("current").setDescription("Repeat the current track")
            .addIntegerOption(opt => opt.setName("count").setDescription("Number of times to repeat (0 = infinite)").setMinValue(0).setRequired(false)))
        .addSubcommand(sub => sub.setName("queue").setDescription("Repeat the entire queue")
            .addIntegerOption(opt => opt.setName("count").setDescription("Number of times to repeat (0 = infinite)").setMinValue(0).setRequired(false)))
        .addSubcommand(sub => sub.setName("disable").setDescription("Disable any active repeat mode"))
        .addSubcommand(sub => sub.setName("status").setDescription("View current repeat status")) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const queue = useQueue(interaction.guildId);
        if (!queue || !queue.isPlaying()) {
            await interaction.reply({ content: i18n.__("common.no_music"), ephemeral: true });
            return;
        }

        const member = interaction.member as GuildMember;
        if (!canModifyQueue(member)) {
            await interaction.reply({ content: i18n.__("common.errorNotChannel"), ephemeral: true });
            return;
        }

        const hasDJ = await hasDJPermission(member);
        if (!hasDJ) {
            await interaction.reply({ content: "‚ùå You need the DJ role to use this command.", ephemeral: true });
            return;
        }

        const sub = interaction.options.getSubcommand();
        const count = interaction.options.getInteger("count") || 0;

        if (sub === "current") {
            queue.setRepeatMode(QueueRepeatMode.TRACK);
            const embed = new EmbedBuilder()
                .setTitle("Ì¥Ç Track Repeat Enabled")
                .setColor(0x3498db)
                .setDescription(count > 0 
                    ? `The current track will repeat **${count}** time(s).`
                    : "The current track will repeat indefinitely.")
                .addFields({ name: "Currently Playing", value: queue.currentTrack?.title || "Unknown", inline: false });
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "queue") {
            queue.setRepeatMode(QueueRepeatMode.QUEUE);
            const embed = new EmbedBuilder()
                .setTitle("Ì¥Å Queue Repeat Enabled")
                .setColor(0x9b59b6)
                .setDescription(count > 0 
                    ? `The queue will repeat **${count}** time(s).`
                    : "The queue will repeat indefinitely.")
                .addFields({ name: "Tracks in Queue", value: `${queue.size + 1}`, inline: true });
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "disable") {
            queue.setRepeatMode(QueueRepeatMode.OFF);
            const embed = new EmbedBuilder()
                .setTitle("‚èπÔ∏è Repeat Disabled")
                .setColor(0xe74c3c)
                .setDescription("Repeat mode has been disabled. Tracks will play through once.");
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "status") {
            const modes = ["Off", "Track", "Queue", "Autoplay"];
            const mode = modes[queue.repeatMode] || "Unknown";
            const embed = new EmbedBuilder()
                .setTitle("Ì¥Ñ Repeat Status")
                .setColor(0x3498db)
                .addFields(
                    { name: "Current Mode", value: mode, inline: true },
                    { name: "Queue Size", value: `${queue.size + 1} tracks`, inline: true }
                );
            
            if (queue.currentTrack) {
                embed.addFields({ name: "Now Playing", value: queue.currentTrack.title, inline: false });
            }
            
            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default repeat;
