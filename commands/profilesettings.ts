import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, AttachmentBuilder } from "discord.js";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

interface UserProfile {
    discordId: string;
    background?: string;
    color?: string;
    avatarShape?: "circle" | "square" | "rounded";
    avatarBorder?: string;
    avatarBackground?: string;
    visibility?: "public" | "private" | "friends";
    serverVisibility?: boolean;
}

// Simple in-memory cache (in production, use database)
const userProfiles: Map<string, UserProfile> = new Map();

const profilesettings: Command = {
    data: new SlashCommandBuilder()
        .setName("profilesettings")
        .setDescription("Customize your profile")
        .addSubcommandGroup(grp => grp.setName("avatar").setDescription("Avatar settings")
            .addSubcommand(sub => sub.setName("shape").setDescription("Set avatar shape")
                .addStringOption(opt => opt.setName("shape").setDescription("Avatar shape").setRequired(true)
                    .addChoices({ name: "Circle", value: "circle" }, { name: "Square", value: "square" }, { name: "Rounded", value: "rounded" })))
            .addSubcommand(sub => sub.setName("border").setDescription("Set avatar border color")
                .addStringOption(opt => opt.setName("color").setDescription("Border color (hex code)").setRequired(true)))
            .addSubcommand(sub => sub.setName("background").setDescription("Set avatar background color")
                .addStringOption(opt => opt.setName("color").setDescription("Background color (hex code)").setRequired(true))))
        .addSubcommand(sub => sub.setName("background").setDescription("Set profile background (Premium)")
            .addStringOption(opt => opt.setName("url").setDescription("Background image URL").setRequired(true)))
        .addSubcommand(sub => sub.setName("color").setDescription("Set profile accent color (Premium)")
            .addStringOption(opt => opt.setName("color").setDescription("Accent color (hex code)").setRequired(true)))
        .addSubcommand(sub => sub.setName("visibility").setDescription("Set profile visibility")
            .addStringOption(opt => opt.setName("level").setDescription("Visibility level").setRequired(true)
                .addChoices({ name: "Public", value: "public" }, { name: "Private", value: "private" }, { name: "Friends Only", value: "friends" })))
        .addSubcommand(sub => sub.setName("servervisibility").setDescription("Show on server leaderboards")
            .addBooleanOption(opt => opt.setName("visible").setDescription("Show on leaderboards").setRequired(true)))
        .addSubcommand(sub => sub.setName("view").setDescription("View current profile settings"))
        .addSubcommand(sub => sub.setName("reset").setDescription("Reset profile to defaults")) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        const userId = interaction.user.id;
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();
        
        // Get or create user profile
        let profile = userProfiles.get(userId) || { discordId: userId };

        if (group === "avatar") {
            if (sub === "shape") {
                const shape = interaction.options.getString("shape", true) as "circle" | "square" | "rounded";
                profile.avatarShape = shape;
                userProfiles.set(userId, profile);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Avatar Updated").setColor(0x2ecc71)
                    .setDescription(`Avatar shape set to: **${shape}**`)] });
            } else if (sub === "border") {
                const color = interaction.options.getString("color", true);
                if (!/^#?[0-9A-Fa-f]{6}$/.test(color)) {
                    await interaction.reply({ content: "Invalid hex color. Use format: #RRGGBB", ephemeral: true });
                    return;
                }
                profile.avatarBorder = color.startsWith("#") ? color : `#${color}`;
                userProfiles.set(userId, profile);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Avatar Updated").setColor(0x2ecc71)
                    .setDescription(`Avatar border color set to: **${profile.avatarBorder}**`)] });
            } else if (sub === "background") {
                const color = interaction.options.getString("color", true);
                if (!/^#?[0-9A-Fa-f]{6}$/.test(color)) {
                    await interaction.reply({ content: "Invalid hex color. Use format: #RRGGBB", ephemeral: true });
                    return;
                }
                profile.avatarBackground = color.startsWith("#") ? color : `#${color}`;
                userProfiles.set(userId, profile);
                await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Avatar Updated").setColor(0x2ecc71)
                    .setDescription(`Avatar background set to: **${profile.avatarBackground}**`)] });
            }
        } else if (sub === "background") {
            const url = interaction.options.getString("url", true);
            // Premium check would go here
            profile.background = url;
            userProfiles.set(userId, profile);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Profile Updated").setColor(0x2ecc71)
                .setDescription("Profile background has been updated.").setThumbnail(url)] });
        } else if (sub === "color") {
            const color = interaction.options.getString("color", true);
            if (!/^#?[0-9A-Fa-f]{6}$/.test(color)) {
                await interaction.reply({ content: "Invalid hex color. Use format: #RRGGBB", ephemeral: true });
                return;
            }
            profile.color = color.startsWith("#") ? color : `#${color}`;
            userProfiles.set(userId, profile);
            
            const colorInt = parseInt(profile.color.replace("#", ""), 16);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Profile Updated").setColor(colorInt)
                .setDescription(`Profile accent color set to: **${profile.color}**`)] });
        } else if (sub === "visibility") {
            const level = interaction.options.getString("level", true) as "public" | "private" | "friends";
            profile.visibility = level;
            userProfiles.set(userId, profile);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Privacy Updated").setColor(0x2ecc71)
                .setDescription(`Profile visibility set to: **${level}**`)] });
        } else if (sub === "servervisibility") {
            const visible = interaction.options.getBoolean("visible", true);
            profile.serverVisibility = visible;
            userProfiles.set(userId, profile);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Privacy Updated").setColor(0x2ecc71)
                .setDescription(visible ? "You will appear on server leaderboards." : "You will be hidden from server leaderboards.")] });
        } else if (sub === "view") {
            const embed = new EmbedBuilder()
                .setTitle("Ì≥ù Profile Settings")
                .setColor(parseInt((profile.color || "#3498db").replace("#", ""), 16))
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    { name: "Avatar Shape", value: profile.avatarShape || "circle", inline: true },
                    { name: "Avatar Border", value: profile.avatarBorder || "None", inline: true },
                    { name: "Avatar Background", value: profile.avatarBackground || "None", inline: true },
                    { name: "Accent Color", value: profile.color || "Default", inline: true },
                    { name: "Visibility", value: profile.visibility || "public", inline: true },
                    { name: "Server Leaderboards", value: profile.serverVisibility !== false ? "Visible" : "Hidden", inline: true }
                );
            
            if (profile.background) {
                embed.setImage(profile.background);
            }
            
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "reset") {
            userProfiles.delete(userId);
            await interaction.reply({ embeds: [new EmbedBuilder().setTitle("Profile Reset").setColor(0xf39c12)
                .setDescription("Your profile settings have been reset to defaults.")] });
        }
    }
};

export default profilesettings;
