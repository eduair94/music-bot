import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../interfaces/Command";
import { i18n } from "../utils/i18n";

// In-memory game scores (in production, use database)
interface GameScore {
    discordId: string;
    guildId: string;
    guessSongWins: number;
    guessSongGames: number;
    totalScore: number;
}

const gameScores: Map<string, GameScore> = new Map();

const gameleaderboard: Command = {
    data: new SlashCommandBuilder()
        .setName("gameleaderboard")
        .setDescription("View game leaderboards")
        .addSubcommand(sub => sub.setName("server").setDescription("View server leaderboard"))
        .addSubcommand(sub => sub.setName("global").setDescription("View global leaderboard"))
        .addSubcommand(sub => sub.setName("me").setDescription("View your game stats")),
    
    async execute(interaction: ChatInputCommandInteraction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "me") {
            const userKey = `${interaction.guildId}-${interaction.user.id}`;
            const score = gameScores.get(userKey);
            
            const embed = new EmbedBuilder()
                .setTitle("í¾® Your Game Stats")
                .setColor(0x9b59b6)
                .setThumbnail(interaction.user.displayAvatarURL());

            if (!score) {
                embed.setDescription("You haven't played any games yet!\n\nTry `/guesssong` to start playing.");
            } else {
                const winRate = score.guessSongGames > 0 
                    ? ((score.guessSongWins / score.guessSongGames) * 100).toFixed(1) 
                    : "0";
                
                embed.addFields(
                    { name: "í¾µ Guess the Song", value: `${score.guessSongWins}/${score.guessSongGames} wins (${winRate}%)`, inline: false },
                    { name: "í¿† Total Score", value: String(score.totalScore), inline: true },
                    { name: "í¾¯ Games Played", value: String(score.guessSongGames), inline: true }
                );
            }
            
            await interaction.reply({ embeds: [embed] });
        } else if (sub === "server") {
            // Filter scores for this guild
            const guildScores = Array.from(gameScores.entries())
                .filter(([key]) => key.startsWith(`${interaction.guildId}-`))
                .map(([, score]) => score)
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, 10);

            const embed = new EmbedBuilder()
                .setTitle("í¿† Server Game Leaderboard")
                .setColor(0xf1c40f);

            if (guildScores.length === 0) {
                embed.setDescription("No game data yet!\n\nBe the first to play - try `/guesssong`!");
            } else {
                const leaderboardText = await Promise.all(guildScores.map(async (score, i) => {
                    const medal = i === 0 ? "íµ‡" : i === 1 ? "íµˆ" : i === 2 ? "íµ‰" : `${i + 1}.`;
                    return `${medal} <@${score.discordId}> - **${score.totalScore}** points`;
                }));
                
                embed.setDescription(leaderboardText.join("\n"));
            }

            await interaction.reply({ embeds: [embed] });
        } else if (sub === "global") {
            // Get all unique users and sum their scores
            const globalScores = new Map<string, { discordId: string; totalScore: number; games: number }>();
            
            gameScores.forEach((score) => {
                const existing = globalScores.get(score.discordId);
                if (existing) {
                    existing.totalScore += score.totalScore;
                    existing.games += score.guessSongGames;
                } else {
                    globalScores.set(score.discordId, {
                        discordId: score.discordId,
                        totalScore: score.totalScore,
                        games: score.guessSongGames
                    });
                }
            });

            const topPlayers = Array.from(globalScores.values())
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, 10);

            const embed = new EmbedBuilder()
                .setTitle("í¼ Global Game Leaderboard")
                .setColor(0xe74c3c);

            if (topPlayers.length === 0) {
                embed.setDescription("No global game data yet!\n\nBe the first to play - try `/guesssong`!");
            } else {
                const leaderboardText = topPlayers.map((player, i) => {
                    const medal = i === 0 ? "íµ‡" : i === 1 ? "íµˆ" : i === 2 ? "íµ‰" : `${i + 1}.`;
                    return `${medal} <@${player.discordId}> - **${player.totalScore}** points (${player.games} games)`;
                });
                
                embed.setDescription(leaderboardText.join("\n"));
            }

            await interaction.reply({ embeds: [embed] });
        }
    }
};

export default gameleaderboard;
