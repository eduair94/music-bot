import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const mappings: Command = {
    data: new SlashCommandBuilder()
        .setName("mappings")
        .setDescription("Manage custom play mappings (shortcuts)")
        .addSubcommandGroup(grp => grp.setName("server").setDescription("Server mappings")
            .addSubcommand(sub => sub.setName("add").setDescription("Add a server mapping")
                .addStringOption(opt => opt.setName("name").setDescription("Mapping name").setRequired(true).setMaxLength(50))
                .addStringOption(opt => opt.setName("url").setDescription("URL or query to map to").setRequired(true)))
            .addSubcommand(sub => sub.setName("remove").setDescription("Remove a server mapping")
                .addStringOption(opt => opt.setName("name").setDescription("Mapping name to remove").setRequired(true)))
            .addSubcommand(sub => sub.setName("clear").setDescription("Clear all server mappings"))
            .addSubcommand(sub => sub.setName("list").setDescription("List server mappings")))
        .addSubcommand(sub => sub.setName("list").setDescription("View all mappings"))
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

        // Initialize mappings object if needed
        const mappingsObj: Record<string, string> = (settings as any).mappings || {};

        if (sub === "list" && !group) {
            const entries = Object.entries(mappingsObj);
            const embed = new EmbedBuilder()
                .setTitle("í·ºï¸ Play Mappings")
                .setColor(0x3498db);
            
            if (entries.length === 0) {
                embed.setDescription("No mappings configured.\n\nUse `/mappings server add` to create shortcuts for frequently played songs/playlists.");
            } else {
                embed.setDescription(entries.map(([name, url]) => 
                    `**${name}** â†’ \`${url.substring(0, 50)}${url.length > 50 ? "..." : ""}\``
                ).join("\n"));
            }
            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (group === "server") {
            if (sub === "add") {
                const name = interaction.options.getString("name", true).toLowerCase();
                const url = interaction.options.getString("url", true);
                
                if (Object.keys(mappingsObj).length >= 50) {
                    await interaction.reply({ content: "Maximum 50 mappings allowed.", ephemeral: true });
                    return;
                }
                
                mappingsObj[name] = url;
                await svc.updateSettings(interaction.guildId, { mappings: mappingsObj } as any);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Mapping Added").setColor(0x2ecc71)
                    .setDescription(`Added mapping: **${name}** â†’ \`${url}\`\n\nUse \`/play ${name}\` to play it!`)] });
            } else if (sub === "remove") {
                const name = interaction.options.getString("name", true).toLowerCase();
                if (!mappingsObj[name]) {
                    await interaction.reply({ content: `Mapping \`${name}\` not found.`, ephemeral: true });
                    return;
                }
                delete mappingsObj[name];
                await svc.updateSettings(interaction.guildId, { mappings: mappingsObj } as any);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Mapping Removed").setColor(0xe74c3c)
                    .setDescription(`Removed mapping: **${name}**`)] });
            } else if (sub === "clear") {
                await svc.updateSettings(interaction.guildId, { mappings: {} } as any);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Mappings Cleared").setColor(0xf39c12)
                    .setDescription("All server mappings have been cleared.")] });
            } else if (sub === "list") {
                const entries = Object.entries(mappingsObj);
                const embed = new EmbedBuilder()
                    .setTitle("í·ºï¸ Server Mappings")
                    .setColor(0x3498db);
                
                if (entries.length === 0) {
                    embed.setDescription("No server mappings configured.");
                } else {
                    embed.setDescription(entries.map(([name, url]) => 
                        `**${name}** â†’ \`${url.substring(0, 50)}${url.length > 50 ? "..." : ""}\``
                    ).join("\n"));
                }
                await interaction.reply({ embeds: [embed] });
            }
        }
    }
};

export default mappings;
