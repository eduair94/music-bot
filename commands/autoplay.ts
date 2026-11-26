import { ChatInputCommandInteraction, GuildMember, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ensureAutoplayNext, isAutoplayTrack } from "../services/autoplay";
import { DiscordPlayerService, QueueMetadata } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { PlayerPanelService } from "../services/playerPanel";
import { logAction } from "../utils/actionLog";
import { hasDJPermission } from "../utils/djPermission";
import { i18n } from "../utils/i18n";

/**
 * /autoplay — when the queue runs out, keep playing related songs (from the
 * YouTube mix of the last one). `default:true` makes it the server default.
 */
export default {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription(i18n.__("autoplay.description"))
    .addBooleanOption((option) => option.setName("enabled").setDescription("On or off (default: toggle)"))
    .addBooleanOption((option) =>
      option.setName("default").setDescription("Also make this the default for this server (Manage Server)")
    ),
  category: "music",
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const member = interaction.member as GuildMember;
    if (!(await hasDJPermission(member))) {
      return interaction.reply({ content: `🎧 ${i18n.__("player.needDj")}`, flags: MessageFlags.Ephemeral });
    }

    const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
    const metadata = (queue?.metadata || {}) as QueueMetadata;
    const settingsService = GuildSettingsService.getInstance();
    const settings = await settingsService.getSettings(interaction.guildId);

    const current = queue && !queue.deleted ? Boolean(metadata.autoplay) : Boolean(settings.autoplay);
    const enabled = interaction.options.getBoolean("enabled") ?? !current;
    const makeDefault = interaction.options.getBoolean("default") ?? false;

    if (makeDefault) {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: `🔒 ${i18n.__("language.needManage")}`, flags: MessageFlags.Ephemeral });
      }
      await settingsService.updateSettings(interaction.guildId, { autoplay: enabled });
    }

    if (queue && !queue.deleted) {
      metadata.autoplay = enabled;
      queue.metadata = metadata;
      if (enabled) {
        void ensureAutoplayNext(queue).then((added) => added && PlayerPanelService.getInstance().refresh(queue));
      } else {
        for (const t of queue.tracks.toArray().filter(isAutoplayTrack)) queue.removeTrack(t);
      }
      PlayerPanelService.getInstance().refresh(queue, true);
    }

    await logAction(interaction.guild, interaction.user, "autoplay", enabled ? "On" : "Off");
    return interaction.reply({
      content: enabled ? `♾️ ${i18n.__("player.autoplayEnabled")}` : `⏹️ ${i18n.__("player.autoplayDisabled")}`
    });
  }
};
