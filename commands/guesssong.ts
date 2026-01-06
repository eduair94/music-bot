import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from "discord.js";
import { useQueue, useHistory } from "discord-player";
import { i18n } from "../utils/i18n";

// Active games per guild
const activeGames = new Map<string, {
  correctTitle: string;
  correctArtist: string;
  hostId: string;
  startedAt: number;
  guesses: Map<string, string>;
}>();

export default {
  data: new SlashCommandBuilder()
    .setName("guesssong")
    .setDescription(i18n.__("guesssong.description"))
    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription(i18n.__("guesssong.start.description"))
    )
    .addSubcommand(sub =>
      sub
        .setName("guess")
        .setDescription(i18n.__("guesssong.guess.description"))
        .addStringOption(opt =>
          opt.setName("answer").setDescription("Your guess").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("stop")
        .setDescription(i18n.__("guesssong.stop.description"))
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    switch (subcommand) {
      case "start": {
        if (!member.voice.channel) {
          return interaction.reply({
            content: i18n.__("guesssong.notInVoice"),
            ephemeral: true
          });
        }

        if (activeGames.has(guildId)) {
          return interaction.reply({
            content: i18n.__("guesssong.alreadyActive"),
            ephemeral: true
          });
        }

        const history = useHistory(guildId);
        
        if (!history || history.tracks.size === 0) {
          return interaction.reply({
            content: i18n.__("guesssong.noHistory"),
            ephemeral: true
          });
        }

        // Pick a random song from history
        const tracks = history.tracks.toArray();
        const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];

        activeGames.set(guildId, {
          correctTitle: randomTrack.title.toLowerCase(),
          correctArtist: randomTrack.author.toLowerCase(),
          hostId: interaction.user.id,
          startedAt: Date.now(),
          guesses: new Map()
        });

        const embed = new EmbedBuilder()
          .setTitle(i18n.__("guesssong.startedTitle"))
          .setDescription(i18n.__("guesssong.started"))
          .setColor("#F8AA2A")
          .addFields({
            name: i18n.__("guesssong.hint"),
            value: `Artist: **${randomTrack.author.charAt(0)}${"_".repeat(randomTrack.author.length - 1)}**`
          })
          .setFooter({ text: i18n.__("guesssong.howToGuess") });

        return interaction.reply({ embeds: [embed] });
      }

      case "guess": {
        const game = activeGames.get(guildId);
        
        if (!game) {
          return interaction.reply({
            content: i18n.__("guesssong.noGame"),
            ephemeral: true
          });
        }

        const guess = interaction.options.getString("answer", true).toLowerCase();
        
        // Check if correct
        const isCorrectTitle = game.correctTitle.includes(guess) || guess.includes(game.correctTitle);
        const isCorrectArtist = game.correctArtist.includes(guess) || guess.includes(game.correctArtist);
        
        if (isCorrectTitle || isCorrectArtist) {
          activeGames.delete(guildId);
          
          const timeTaken = Math.floor((Date.now() - game.startedAt) / 1000);
          
          const embed = new EmbedBuilder()
            .setTitle(i18n.__("guesssong.winnerTitle"))
            .setDescription(i18n.__mf("guesssong.winner", { 
              user: interaction.user.username,
              time: timeTaken
            }))
            .setColor("#00FF00")
            .addFields({
              name: i18n.__("guesssong.answer"),
              value: `**${game.correctTitle}** - ${game.correctArtist}`
            });

          return interaction.reply({ embeds: [embed] });
        }

        return interaction.reply({
          content: i18n.__("guesssong.wrong"),
          ephemeral: true
        });
      }

      case "stop": {
        const game = activeGames.get(guildId);
        
        if (!game) {
          return interaction.reply({
            content: i18n.__("guesssong.noGame"),
            ephemeral: true
          });
        }

        if (game.hostId !== interaction.user.id) {
          return interaction.reply({
            content: i18n.__("guesssong.notHost"),
            ephemeral: true
          });
        }

        activeGames.delete(guildId);

        const embed = new EmbedBuilder()
          .setTitle(i18n.__("guesssong.stoppedTitle"))
          .setDescription(i18n.__("guesssong.stopped"))
          .setColor("#FF0000")
          .addFields({
            name: i18n.__("guesssong.answer"),
            value: `**${game.correctTitle}** - ${game.correctArtist}`
          });

        return interaction.reply({ embeds: [embed] });
      }
    }
  }
};
