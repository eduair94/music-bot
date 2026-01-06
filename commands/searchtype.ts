import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import { Command } from "../interfaces/Command";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

const SEARCH_TYPES = ["youtube", "soundcloud", "spotify", "auto"] as const;
type SearchType = typeof SEARCH_TYPES[number];

const searchtype: Command = {
    data: new SlashCommandBuilder()
        .setName("searchtype")
        .setDescription("Configure default search type")
        .addSubcommand(sub => sub.setName("set").setDescription("Set default search type")
            .addStringOption(opt => opt.setName("type").setDescription("Default search type").setRequired(true)
                .addChoices(
                    { name: "YouTube", value: "youtube" },
                    { name: "SoundCloud", value: "soundcloud" },
                    { name: "Spotify", value: "spotify" },
                    { name: "Auto (detect URL)", value: "auto" }
                )))
        .addSubcommand(sub => sub.setName("view").setDescription("View current search type"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) as SlashCommandBuilder,
    
    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: i18n.__("common.guild_only"), ephemeral: true });
            return;
        }

        const sub = interaction.options.getSubcommand();
        const svc = GuildSettingsService.getInstance();
        const settings = await svc.getSettings(interaction.guildId);
        const extSettings = settings as any;

        const typeIcons: Record<SearchType, string> = {
            youtube: "Ì¥¥",
            soundcloud: "Ìø†",
            spotify: "Ìø¢",
            auto: "Ì¥Ñ"
        };

        if (sub === "set") {
            const type = interaction.options.getString("type", true) as SearchType;
            await svc.updateSettings(interaction.guildId, { defaultSearchType: type } as any);

            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(`${typeIcons[type]} Default Search Type Set`)
                .setColor(0x2ecc71)
                .setDescription(`Default search type set to **${type.charAt(0).toUpperCase() + type.slice(1)}**.\n\nPlain text searches will now search on ${type === "auto" ? "the detected platform" : type}.`)] });
        } else if (sub === "view") {
            const currentType = (extSettings.defaultSearchType || "youtube") as SearchType;
            
            const embed = new EmbedBuilder()
                .setTitle("Ì¥ç Default Search Type")
                .setColor(0x3498db)
                .addFields(
                    { name: "Current", value: `${typeIcons[currentType]} ${currentType.charAt(0).toUpperCase() + currentType.slice(1)}`, inline: true }
                )
                .setDescription("This determines where plain text searches are performed.\n\nDirect URLs are always resolved to their platform.");

            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default searchtype;
