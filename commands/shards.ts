import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("shards")
    .setDescription(i18n.__("shards.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client;
    const shardId = interaction.guild?.shardId ?? 0;
    const totalShards = client.shard?.count ?? 1;
    const guilds = client.guilds.cache.size;
    const users = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
    const ping = client.ws.ping;

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("shards.title"))
      .setColor("#F8AA2A")
      .addFields(
        { 
          name: i18n.__("shards.currentShard"), 
          value: `#${shardId}`, 
          inline: true 
        },
        { 
          name: i18n.__("shards.totalShards"), 
          value: totalShards.toString(), 
          inline: true 
        },
        { 
          name: i18n.__("shards.ping"), 
          value: `${ping}ms`, 
          inline: true 
        },
        { 
          name: i18n.__("shards.guilds"), 
          value: guilds.toLocaleString(), 
          inline: true 
        },
        { 
          name: i18n.__("shards.users"), 
          value: users.toLocaleString(), 
          inline: true 
        },
        { 
          name: i18n.__("shards.status"), 
          value: "í¿¢ Online", 
          inline: true 
        }
      )
      .setFooter({ 
        text: i18n.__mf("shards.footer", { shardId }) 
      });

    return interaction.reply({ embeds: [embed] });
  }
};
