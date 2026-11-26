import { GuildQueue, QueueRepeatMode } from "discord-player";
import { ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, SeparatorSpacingSize } from "discord.js";
import { registerComponentHandler } from "../structs/componentRouter";
import { formatDuration, isHttpUrl, linkLabel, safeText } from "../utils/format";
import { i18n } from "../utils/i18n";
import { isAutoplayTrack } from "./autoplay";
import { DiscordPlayerService, QueueMetadata } from "./discordPlayer";

const PAGE_SIZE = 10;
const ACCENT = 0xf8aa2a;

/**
 * The queue as a Components V2 message, PAGE_SIZE songs per page. Page
 * buttons carry the page number in their custom id (`queue:page:2`), so they
 * keep working on any queue message, ephemeral or not, without a collector.
 */
export async function buildQueueView(queue: GuildQueue, page: number): Promise<{ components: ContainerBuilder[] }> {
  const tracks = queue.tracks.toArray();
  const pages = Math.max(1, Math.ceil(tracks.length / PAGE_SIZE));
  const current = Math.min(Math.max(0, page), pages - 1);
  const metadata = (queue.metadata || {}) as QueueMetadata;
  const playing = queue.currentTrack ?? metadata.currentTrack ?? null;

  const container = new ContainerBuilder().setAccentColor(ACCENT);
  const totalMs = tracks.reduce((sum, t) => sum + (t.durationMS || 0), 0) + (playing?.durationMS || 0);

  const head = [`### 📜 ${i18n.__("queueView.title")}`];
  if (playing) {
    const title = isHttpUrl(playing.url) ? `[${linkLabel(playing.title, 70)}](${playing.url})` : safeText(playing.title, 70);
    const stamp = queue.node.getTimestamp();
    head.push(
      `**${i18n.__("queueView.nowPlaying")}:** ${title} · \`${formatDuration(stamp?.current.value ?? 0)} / ${formatDuration(playing.durationMS)}\``
    );
  }
  container.addTextDisplayComponents((t) => t.setContent(head.join("\n")));
  container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  if (tracks.length === 0) {
    container.addTextDisplayComponents((t) => t.setContent(i18n.__("queueView.empty")));
  } else {
    const start = current * PAGE_SIZE;
    const lines = tracks.slice(start, start + PAGE_SIZE).map((track, i) => {
      const n = start + i + 1;
      const label = isHttpUrl(track.url) ? `[${linkLabel(track.title, 60)}](${track.url})` : safeText(track.title, 60);
      const who = isAutoplayTrack(track) ? " · ♾️" : track.requestedBy && !track.requestedBy.bot ? ` · <@${track.requestedBy.id}>` : "";
      return `\`${String(n).padStart(2, " ")}.\` ${label} · \`${formatDuration(track.durationMS)}\`${who}`;
    });
    container.addTextDisplayComponents((t) => t.setContent(lines.join("\n")));
  }

  const footer = [i18n.__mf("queueView.summary", { count: tracks.length, duration: formatDuration(totalMs) })];
  if (queue.repeatMode === QueueRepeatMode.TRACK) footer.push(`🔂 ${i18n.__("player.loopTrack")}`);
  if (queue.repeatMode === QueueRepeatMode.QUEUE) footer.push(`🔁 ${i18n.__("player.loopQueue")}`);
  if (metadata.autoplay) footer.push(`♾️ ${i18n.__("player.autoplayOn")}`);
  footer.push(i18n.__mf("queueView.page", { page: current + 1, pages }));
  container.addTextDisplayComponents((t) => t.setContent(`-# ${footer.join(" · ")}`));

  if (pages > 1) {
    container.addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId(`queue:page:${current - 1}`)
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(current === 0),
        new ButtonBuilder()
          .setCustomId(`queue:page:${current}:refresh`)
          .setEmoji("🔄")
          .setLabel(i18n.__("queueView.refresh"))
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`queue:page:${current + 1}`)
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(current >= pages - 1)
      )
    );
  } else {
    container.addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder().setCustomId(`queue:page:0:refresh`).setEmoji("🔄").setLabel(i18n.__("queueView.refresh")).setStyle(ButtonStyle.Secondary)
      )
    );
  }

  return { components: [container] };
}

registerComponentHandler("queue", async (interaction, args) => {
  if (!interaction.isButton() || !interaction.inCachedGuild()) return;
  const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
  if (!queue || queue.deleted) {
    const empty = new ContainerBuilder()
      .setAccentColor(ACCENT)
      .addTextDisplayComponents((t) => t.setContent(i18n.__("queueView.nothingPlaying")));
    return interaction.update({ components: [empty], flags: MessageFlags.IsComponentsV2 } as any);
  }
  const page = Number(args[1]) || 0;
  return interaction.update({ ...(await buildQueueView(queue, page)), allowedMentions: { parse: [] } } as any);
});
