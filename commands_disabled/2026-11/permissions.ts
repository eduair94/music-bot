import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const PERMISSION_TYPES = [
    "play", "pause", "resume", "skip", "stop", "volume", "seek", "queue",
    "remove", "clear", "shuffle", "loop", "filter", "move", "jump"
];

const permissions: Command = {
    data: new SlashCommandBuilder()
        .setName("permissions")
        .setDescription("Manage command permissions for roles")
        .addSubcommand(sub => sub.setName("view").setDescription("View current permission settings"))
        .addSubcommand(sub => sub.setName("allow").setDescription("Allow a permission for a role")
            .addStringOption(opt => opt.setName("permission").setDescription("The permission").setRequired(true)
                .addChoices(...PERMISSION_TYPES.slice(0, 25).map(p => ({ name: p, value: p }))))
            .addRoleOption(opt => opt.setName("role").setDescription("The role").setRequired(false)))
        .addSubcommand(sub => sub.setName("deny").setDescription("Deny a permission for a role")
            .addStringOption(opt => opt.setName("permission").setDescription("The permission").setRequired(true)
                .addChoices(...PERMISSION_TYPES.slice(0, 25).map(p => ({ name: p, value: p }))))
            .addRoleOption(opt => opt.setName("role").setDescription("The role").setRequired(false)))
        .addSubcommand(sub => sub.setName("reset").setDescription("Reset all permissions"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const settingsService = GuildSettingsService.getInstance();
        const settings = await settingsService.getSettings(interaction.guildId);
        const perms = (settings as any).permissions || {};

        if (subcommand === "view") {
            const embed = new EmbedBuilder().setTitle("Permission Settings").setColor(0x3498db);
            if (Object.keys(perms).length === 0) {
                embed.setDescription("No custom permissions configured.");
            } else {
                for (const [perm, data] of Object.entries(perms)) {
                    const rd = data as { allowed: string[]; denied: string[] };
                    let val = "";
                    if (rd.allowed?.length) val += `Allowed: ${rd.allowed.map(r => `<@&${r}>`).join(", ")}\n`;
                    if (rd.denied?.length) val += `Denied: ${rd.denied.map(r => `<@&${r}>`).join(", ")}`;
                    if (val) embed.addFields({ name: perm.toUpperCase(), value: val, inline: true });
                }
            }
            await interaction.reply({ embeds: [embed] });
        } else if (subcommand === "allow") {
            const perm = interaction.options.getString("permission", true);
            const role = interaction.options.getRole("role");
            const roleId = role?.id || "everyone";
            if (!perms[perm]) perms[perm] = { allowed: [], denied: [] };
            perms[perm].denied = perms[perm].denied.filter((r: string) => r !== roleId);
            if (!perms[perm].allowed.includes(roleId)) perms[perm].allowed.push(roleId);
            await settingsService.updateSettings(interaction.guildId, { permissions: perms } as any);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Permission Allowed").setColor(0x2ecc71)
                .setDescription(`${perm.toUpperCase()} allowed for ${role ? `<@&${role.id}>` : "everyone"}`)] });
        } else if (subcommand === "deny") {
            const perm = interaction.options.getString("permission", true);
            const role = interaction.options.getRole("role");
            const roleId = role?.id || "everyone";
            if (!perms[perm]) perms[perm] = { allowed: [], denied: [] };
            perms[perm].allowed = perms[perm].allowed.filter((r: string) => r !== roleId);
            if (!perms[perm].denied.includes(roleId)) perms[perm].denied.push(roleId);
            await settingsService.updateSettings(interaction.guildId, { permissions: perms } as any);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Permission Denied").setColor(0xe74c3c)
                .setDescription(`${perm.toUpperCase()} denied for ${role ? `<@&${role.id}>` : "everyone"}`)] });
        } else if (subcommand === "reset") {
            await settingsService.updateSettings(interaction.guildId, { permissions: {} } as any);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Permissions Reset").setColor(0xf39c12)
                .setDescription("All permissions reset to default.")] });
        }
    }
};

export default permissions;
