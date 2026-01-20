import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const alias: Command = {
    data: new SlashCommandBuilder()
        .setName("alias")
        .setDescription("Manage command aliases")
        .addSubcommandGroup(grp => grp.setName("server").setDescription("Server aliases")
            .addSubcommand(sub => sub.setName("add").setDescription("Add alias")
                .addStringOption(opt => opt.setName("alias").setDescription("Alias name").setRequired(true))
                .addStringOption(opt => opt.setName("command").setDescription("Command to run").setRequired(true)))
            .addSubcommand(sub => sub.setName("remove").setDescription("Remove alias")
                .addStringOption(opt => opt.setName("alias").setDescription("Alias to remove").setRequired(true)))
            .addSubcommand(sub => sub.setName("list").setDescription("List aliases"))
            .addSubcommand(sub => sub.setName("clear").setDescription("Clear all aliases")))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const grp = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        const aliases = (settings as any).aliases || {};

        if (grp === "server") {
            if (sub === "add") {
                const name = interaction.options.getString("alias", true).toLowerCase();
                const cmd = interaction.options.getString("command", true);
                if (name.includes(" ")) {
                    await interaction.reply({ content: "Alias cannot contain spaces.", ephemeral: true });
                    return;
                }
                aliases[name] = cmd;
                await svc.updateSettings(interaction.guildId, { aliases } as any);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Alias Added").setColor(0x2ecc71)
                    .setDescription(`\`${name}\` -> \`${cmd}\``)] });
            } else if (sub === "remove") {
                const name = interaction.options.getString("alias", true).toLowerCase();
                if (!aliases[name]) {
                    await interaction.reply({ content: "Alias not found.", ephemeral: true });
                    return;
                }
                delete aliases[name];
                await svc.updateSettings(interaction.guildId, { aliases } as any);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Alias Removed").setColor(0xe74c3c)
                    .setDescription(`\`${name}\` removed`)] });
            } else if (sub === "list") {
                const entries = Object.entries(aliases);
                const embed = new EmbedBuilder().setTitle("Server Aliases").setColor(0x3498db);
                if (entries.length === 0) {
                    embed.setDescription("No aliases configured.");
                } else {
                    embed.setDescription(entries.map(([a, c]) => `\`${a}\` -> \`${c}\``).join("\n"));
                }
                await interaction.reply({ embeds: [embed] });
            } else if (sub === "clear") {
                await svc.updateSettings(interaction.guildId, { aliases: {} } as any);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Aliases Cleared").setColor(0xf39c12)
                    .setDescription("All aliases cleared.")] });
            }
        }
    }
};

export default alias;
