import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import { i18n } from "../utils/i18n";
import { GuildSettingsService } from "../services/guildSettings";

export default {
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription(i18n.__("blacklist.description"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName("author")
        .setDescription(i18n.__("blacklist.author.description"))
        .addStringOption(opt =>
          opt.setName("name").setDescription("Author/artist name").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("title")
        .setDescription(i18n.__("blacklist.title.description"))
        .addStringOption(opt =>
          opt.setName("keyword").setDescription("Title keyword").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription(i18n.__("blacklist.list.description"))
    )
    .addSubcommand(sub =>
      sub
        .setName("removeauthor")
        .setDescription(i18n.__("blacklist.removeauthor.description"))
        .addStringOption(opt =>
          opt.setName("name").setDescription("Author/artist name to remove").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("removetitle")
        .setDescription(i18n.__("blacklist.removetitle.description"))
        .addStringOption(opt =>
          opt.setName("keyword").setDescription("Title keyword to remove").setRequired(true)
        )
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();
    const settingsService = GuildSettingsService.getInstance();
    const settings = await settingsService.getSettings(guildId);

    switch (subcommand) {
      case "author": {
        const name = interaction.options.getString("name", true).toLowerCase();
        const authors = settings.blacklistedAuthors || [];
        
        if (authors.includes(name)) {
          return interaction.reply({
            content: i18n.__mf("blacklist.author.exists", { name }),
            ephemeral: true
          });
        }

        authors.push(name);
        await settingsService.updateSettings(guildId, { blacklistedAuthors: authors });

        const embed = new EmbedBuilder()
          .setTitle(i18n.__("blacklist.author.title"))
          .setDescription(i18n.__mf("blacklist.author.added", { name }))
          .setColor("#F8AA2A");

        return interaction.reply({ embeds: [embed] });
      }

      case "title": {
        const keyword = interaction.options.getString("keyword", true).toLowerCase();
        const titles = settings.blacklistedTitles || [];
        
        if (titles.includes(keyword)) {
          return interaction.reply({
            content: i18n.__mf("blacklist.title.exists", { keyword }),
            ephemeral: true
          });
        }

        titles.push(keyword);
        await settingsService.updateSettings(guildId, { blacklistedTitles: titles });

        const embed = new EmbedBuilder()
          .setTitle(i18n.__("blacklist.title.addedTitle"))
          .setDescription(i18n.__mf("blacklist.title.added", { keyword }))
          .setColor("#F8AA2A");

        return interaction.reply({ embeds: [embed] });
      }

      case "list": {
        const authors = settings.blacklistedAuthors || [];
        const titles = settings.blacklistedTitles || [];

        if (authors.length === 0 && titles.length === 0) {
          return interaction.reply({
            content: i18n.__("blacklist.list.empty"),
            ephemeral: true
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(i18n.__("blacklist.list.title"))
          .setColor("#F8AA2A");

        if (authors.length > 0) {
          embed.addFields({
            name: i18n.__("blacklist.list.authors"),
            value: authors.map(a => `\`${a}\``).join(", ") || "None"
          });
        }

        if (titles.length > 0) {
          embed.addFields({
            name: i18n.__("blacklist.list.titles"),
            value: titles.map(t => `\`${t}\``).join(", ") || "None"
          });
        }

        return interaction.reply({ embeds: [embed] });
      }

      case "removeauthor": {
        const name = interaction.options.getString("name", true).toLowerCase();
        const authors = settings.blacklistedAuthors || [];
        
        if (!authors.includes(name)) {
          return interaction.reply({
            content: i18n.__mf("blacklist.removeauthor.notfound", { name }),
            ephemeral: true
          });
        }

        const newAuthors = authors.filter((a: string) => a !== name);
        await settingsService.updateSettings(guildId, { blacklistedAuthors: newAuthors });

        const embed = new EmbedBuilder()
          .setTitle(i18n.__("blacklist.removeauthor.title"))
          .setDescription(i18n.__mf("blacklist.removeauthor.removed", { name }))
          .setColor("#F8AA2A");

        return interaction.reply({ embeds: [embed] });
      }

      case "removetitle": {
        const keyword = interaction.options.getString("keyword", true).toLowerCase();
        const titles = settings.blacklistedTitles || [];
        
        if (!titles.includes(keyword)) {
          return interaction.reply({
            content: i18n.__mf("blacklist.removetitle.notfound", { keyword }),
            ephemeral: true
          });
        }

        const newTitles = titles.filter((t: string) => t !== keyword);
        await settingsService.updateSettings(guildId, { blacklistedTitles: newTitles });

        const embed = new EmbedBuilder()
          .setTitle(i18n.__("blacklist.removetitle.title"))
          .setDescription(i18n.__mf("blacklist.removetitle.removed", { keyword }))
          .setColor("#F8AA2A");

        return interaction.reply({ embeds: [embed] });
      }
    }
  }
};
