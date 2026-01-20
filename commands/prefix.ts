import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const prefix: Command = {
    data: new SlashCommandBuilder()
        .setName("prefix")
        .setDescription("Manage command prefixes")
        .addSubcommandGroup(grp => grp.setName("server").setDescription("Server prefixes")
            .addSubcommand(sub => sub.setName("add").setDescription("Add a server prefix")
                .addStringOption(opt => opt.setName("prefix").setDescription("Prefix to add").setRequired(true).setMaxLength(10)))
            .addSubcommand(sub => sub.setName("remove").setDescription("Remove a server prefix")
                .addStringOption(opt => opt.setName("prefix").setDescription("Prefix to remove").setRequired(true)))
            .addSubcommand(sub => sub.setName("set").setDescription("Set the only server prefix")
                .addStringOption(opt => opt.setName("prefix").setDescription("Prefix to set").setRequired(true).setMaxLength(10)))
            .addSubcommand(sub => sub.setName("reset").setDescription("Reset server prefixes to default"))
            .addSubcommand(sub => sub.setName("list").setDescription("List server prefixes")))
        .addSubcommand(sub => sub.setName("list").setDescription("View all prefixes"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();

        // Initialize prefixes array if needed
        const prefixes = settings.prefixes || ["!"];

        if (sub === "list" && !group) {
            const embed = new EmbedBuilder()
                .setTitle("��� Prefixes")
                .setColor(0x3498db)
                .setDescription(`**Server Prefixes:**\n${prefixes.map(p => `\`${p}\``).join(", ") || "None"}\n\n*Note: Slash commands (/) always work regardless of prefix.*`);
            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (group === "server") {
            if (sub === "add") {
                const newPrefix = interaction.options.getString("prefix", true);
                if (prefixes.includes(newPrefix)) {
                    await interaction.reply({ content: `Prefix \`${newPrefix}\` already exists.`, ephemeral: true });
                    return;
                }
                if (prefixes.length >= 10) {
                    await interaction.reply({ content: "Maximum 10 prefixes allowed.", ephemeral: true });
                    return;
                }
                prefixes.push(newPrefix);
                await svc.updateSettings(interaction.guildId, { prefixes });
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Prefix Added").setColor(0x2ecc71)
                    .setDescription(`Added prefix: \`${newPrefix}\``)] });
            } else if (sub === "remove") {
                const toRemove = interaction.options.getString("prefix", true);
                const idx = prefixes.indexOf(toRemove);
                if (idx === -1) {
                    await interaction.reply({ content: `Prefix \`${toRemove}\` not found.`, ephemeral: true });
                    return;
                }
                prefixes.splice(idx, 1);
                await svc.updateSettings(interaction.guildId, { prefixes });
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Prefix Removed").setColor(0xe74c3c)
                    .setDescription(`Removed prefix: \`${toRemove}\``)] });
            } else if (sub === "set") {
                const newPrefix = interaction.options.getString("prefix", true);
                await svc.updateSettings(interaction.guildId, { prefixes: [newPrefix] });
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Prefix Set").setColor(0x2ecc71)
                    .setDescription(`Server prefix set to: \`${newPrefix}\``)] });
            } else if (sub === "reset") {
                await svc.updateSettings(interaction.guildId, { prefixes: ["!"] });
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Prefixes Reset").setColor(0xf39c12)
                    .setDescription("Server prefixes reset to default: `!`")] });
            } else if (sub === "list") {
                const embed = new EmbedBuilder()
                    .setTitle("��� Server Prefixes")
                    .setColor(0x3498db)
                    .setDescription(prefixes.length > 0 ? prefixes.map(p => `\`${p}\``).join(", ") : "No prefixes set (using default)");
                await interaction.reply({ embeds: [embed] });
            }
        }
    }
};

export default prefix;
