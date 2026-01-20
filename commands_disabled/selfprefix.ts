import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

// Personal prefixes stored per-user - in production this would be in MongoDB
const userPrefixes = new Map<string, {
    prefixes: string[];
    combineWithServer: boolean;
}>();

const selfprefix: Command = {
    data: new SlashCommandBuilder()
        .setName("selfprefix")
        .setDescription("Manage your personal prefixes")
        .addSubcommand(sub => sub.setName("add").setDescription("Add a personal prefix")
            .addStringOption(opt => opt.setName("prefix").setDescription("Prefix to add").setRequired(true).setMaxLength(10)))
        .addSubcommand(sub => sub.setName("remove").setDescription("Remove a personal prefix")
            .addStringOption(opt => opt.setName("prefix").setDescription("Prefix to remove").setRequired(true)))
        .addSubcommand(sub => sub.setName("set").setDescription("Set your only personal prefix")
            .addStringOption(opt => opt.setName("prefix").setDescription("Prefix to set").setRequired(true).setMaxLength(10)))
        .addSubcommand(sub => sub.setName("list").setDescription("List your personal prefixes"))
        .addSubcommand(sub => sub.setName("reset").setDescription("Reset your personal prefixes"))
        .addSubcommand(sub => sub.setName("combine").setDescription("Combine with server prefixes")
            .addBooleanOption(opt => opt.setName("enabled").setDescription("Combine with server prefixes").setRequired(true))),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        
        // Get or create user prefixes
        if (!userPrefixes.has(userId)) {
            userPrefixes.set(userId, { prefixes: [], combineWithServer: true });
        }
        const prefs = userPrefixes.get(userId)!;

        if (sub === "add") {
            const prefix = interaction.options.getString("prefix", true);
            
            if (prefs.prefixes.length >= 5) {
                await interaction.reply({ content: "You can only have up to 5 personal prefixes.", ephemeral: true });
                return;
            }
            
            if (prefs.prefixes.includes(prefix)) {
                await interaction.reply({ content: `Prefix \`${prefix}\` already exists.`, ephemeral: true });
                return;
            }

            prefs.prefixes.push(prefix);
            
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("‚ûï Personal Prefix Added")
                .setColor(0x2ecc71)
                .setDescription(`Added prefix: \`${prefix}\`\n\nYour prefixes: ${prefs.prefixes.map(p => `\`${p}\``).join(", ")}`)], ephemeral: true });
        } else if (sub === "remove") {
            const prefix = interaction.options.getString("prefix", true);
            const index = prefs.prefixes.indexOf(prefix);
            
            if (index === -1) {
                await interaction.reply({ content: `Prefix \`${prefix}\` not found.`, ephemeral: true });
                return;
            }

            prefs.prefixes.splice(index, 1);
            
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("‚ûñ Personal Prefix Removed")
                .setColor(0xe74c3c)
                .setDescription(`Removed prefix: \`${prefix}\`\n\nYour prefixes: ${prefs.prefixes.length ? prefs.prefixes.map(p => `\`${p}\``).join(", ") : "None"}`)], ephemeral: true });
        } else if (sub === "set") {
            const prefix = interaction.options.getString("prefix", true);
            prefs.prefixes = [prefix];
            
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("‚úèÔ∏è Personal Prefix Set")
                .setColor(0x2ecc71)
                .setDescription(`Your prefix is now: \`${prefix}\``)], ephemeral: true });
        } else if (sub === "list") {
            const embed = new EmbedBuilder()
                .setTitle("Ì≥ã Your Personal Prefixes")
                .setColor(0x3498db)
                .addFields(
                    { name: "Prefixes", value: prefs.prefixes.length ? prefs.prefixes.map(p => `\`${p}\``).join(", ") : "None set", inline: true },
                    { name: "Combine with Server", value: prefs.combineWithServer ? "‚úÖ Yes" : "‚ùå No", inline: true }
                )
                .setDescription("Personal prefixes work in addition to or instead of server prefixes.");

            await interaction.reply({ embeds: [embed], ephemeral: true });
        } else if (sub === "reset") {
            prefs.prefixes = [];
            
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle("Ì¥Ñ Personal Prefixes Reset")
                .setColor(0x2ecc71)
                .setDescription("Your personal prefixes have been cleared.")], ephemeral: true });
        } else if (sub === "combine") {
            const enabled = interaction.options.getBoolean("enabled", true);
            prefs.combineWithServer = enabled;
            
            await interaction.reply({ embeds: [new EmbedBuilder()
                .setTitle(enabled ? "Ì¥ó Prefix Combining Enabled" : "Ì¥ó Prefix Combining Disabled")
                .setColor(0x2ecc71)
                .setDescription(enabled 
                    ? "Your personal prefixes will work alongside server prefixes."
                    : "Only your personal prefixes will work (server prefixes ignored).")], ephemeral: true });
        }
    }
};

export default selfprefix;
