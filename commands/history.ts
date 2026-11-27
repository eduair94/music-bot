import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  GuildMember,
  MessageFlags,
  SeparatorSpacingSize,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel
} from "discord.js";
import type { IPlayHistory } from "../models/PlayHistory";
import { dispatchPlay } from "../services/fleet/dispatcher";
import { PlayHistoryService } from "../services/playHistory";
import { registerComponentHandler } from "../structs/componentRouter";
import { formatDuration, isHttpUrl, linkLabel, safeText, truncate } from "../utils/format";
import { descriptionLocalizations, i18n } from "../utils/i18n";
import {
  buildPlayReply,
  enqueue,
  EnqueueResult,
  isRequesterRejection,
  playErrorMessage,
  playGate,
  PlayRejection,
  playRejectionMessage
} from "../utils/playFlow";

const PAGE_SIZE = 10;
const ACCENT = 0xf8aa2a;
const V2 = MessageFlags.IsComponentsV2;
const NO_MENTIONS = { parse: [] as [] };
/** Longer links are shown as plain text so ten lines stay within the message limit. */
const MAX_LINK_LENGTH = 150;

// Record every song that starts playing, once the player is up.
PlayHistoryService.getInstance().start();

/** What to search to play a stored song again. */
function replayQuery(record: IPlayHistory): string {
  if (isHttpUrl(record.url)) return record.url;
  return `${record.author} ${record.title}`.trim();
}

function unix(date: Date | string): number {
  return Math.floor(new Date(date).getTime() / 1000);
}

/**
 * One page of the server's play history. Every component carries the page
 * and the member filter in its custom id (`history:page:2:<userId>`), and the
 * "Play again" menu values are stored play ids, so old messages keep working
 * after restarts.
 */
export async function buildHistoryView(guildId: string, page: number, userId: string | null): Promise<{ components: ContainerBuilder[] }> {
  const records = await PlayHistoryService.getInstance().recent(guildId, userId);
  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const current = Math.min(Math.max(0, page), pages - 1);
  const filter = userId ?? "";
  const who = userId ? `<@${userId}>` : "";

  const container = new ContainerBuilder().setAccentColor(ACCENT);
  const title = userId ? i18n.__mf("history.titleUser", { user: who }) : i18n.__("history.title");
  container.addTextDisplayComponents((t) => t.setContent(`### 🕘 ${title}`));
  container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  if (records.length === 0) {
    const empty = userId ? i18n.__mf("history.emptyUser", { user: who }) : i18n.__("history.empty");
    container.addTextDisplayComponents((t) => t.setContent(empty));
    return { components: [container] };
  }

  const start = current * PAGE_SIZE;
  const slice = records.slice(start, start + PAGE_SIZE);
  const lines = slice.map((record, i) => {
    const n = String(start + i + 1).padStart(2, " ");
    const label =
      isHttpUrl(record.url) && record.url.length <= MAX_LINK_LENGTH
        ? `[${linkLabel(record.title, 55)}](${record.url})`
        : safeText(record.title, 55);
    const length = record.duration > 0 ? ` · \`${formatDuration(record.duration)}\`` : "";
    const by = record.autoplay ? " · ♾️" : record.requestedBy ? ` · <@${record.requestedBy.id}>` : "";
    return `\`${n}.\` ${label}${length}${by} · <t:${unix(record.playedAt)}:R>`;
  });
  container.addTextDisplayComponents((t) => t.setContent(lines.join("\n")));

  const footer = [i18n.__mf("history.summary", { count: records.length }), i18n.__mf("queueView.page", { page: current + 1, pages })];
  container.addTextDisplayComponents((t) => t.setContent(`-# ${footer.join(" · ")}`));

  container.addActionRowComponents((row) =>
    row.setComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`history:again:${current}:${filter}`)
        .setPlaceholder(`▶️ ${i18n.__("history.playAgain")}`)
        .setMinValues(1)
        .setMaxValues(slice.length)
        .addOptions(
          slice.map((record, i) => {
            const details = [record.author, record.duration > 0 ? formatDuration(record.duration) : ""].filter(Boolean).join(" · ");
            return {
              label: truncate(`${start + i + 1}. ${record.title}`, 100),
              value: String(record._id),
              ...(details ? { description: truncate(details, 100) } : {})
            };
          })
        )
    )
  );
  container.addActionRowComponents((row) =>
    row.setComponents(
      new ButtonBuilder()
        .setCustomId(`history:page:${current - 1}:${filter}`)
        .setEmoji("◀️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(current === 0),
      new ButtonBuilder()
        .setCustomId(`history:page:${current}:${filter}:refresh`)
        .setEmoji("🔄")
        .setLabel(i18n.__("queueView.refresh"))
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`history:page:${current + 1}:${filter}`)
        .setEmoji("▶️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(current >= pages - 1)
    )
  );

  return { components: [container] };
}

const unavailable = () => `⚠️ ${i18n.__("history.unavailable")}`;

/** Private answer to a menu or button press (the message itself is updated in place). */
function privately(interaction: ButtonInteraction<"cached"> | StringSelectMenuInteraction<"cached">, payload: Record<string, unknown>) {
  return interaction
    .followUp({ allowedMentions: NO_MENTIONS, ...payload, flags: ((payload.flags as number) ?? 0) | MessageFlags.Ephemeral } as any)
    .catch(console.error);
}

/** Queue the picked songs again, with whoever picked them as the requester. */
async function playAgain(interaction: StringSelectMenuInteraction<"cached">, page: number, userId: string | null) {
  await interaction.deferUpdate();

  let records: IPlayHistory[];
  try {
    records = await PlayHistoryService.getInstance().findByIds(interaction.guildId, interaction.values);
  } catch (error) {
    console.warn("[history] Lookup failed:", (error as Error)?.message ?? error);
    return privately(interaction, { content: unavailable() });
  }

  // Redraw the page: newer plays show up and the menu's selection clears.
  const view = await buildHistoryView(interaction.guildId, page, userId).catch(() => null);
  if (view) await interaction.editReply({ ...view, allowedMentions: NO_MENTIONS } as any).catch(() => undefined);

  if (records.length === 0) return privately(interaction, { content: `🕘 ${i18n.__("history.gone")}` });

  const member = interaction.member as GuildMember;
  const gate = await playGate(interaction.guildId, member).catch(() => null);
  if (gate) return privately(interaction, { content: playRejectionMessage(gate, "") });

  // Fleet: when another Bypass instance serves (or should serve) the member's
  // voice channel, it gets the picked songs.
  const [first, ...more] = records;
  const handedOff = await dispatchPlay({
    interaction,
    query: replayQuery(first),
    followUp: true,
    collection: more.length
      ? {
          name: i18n.__("history.title"),
          tracks: more.map((r) => ({ title: r.title, author: r.author, url: r.url, thumbnail: r.thumbnail, duration: Math.round((r.duration || 0) / 1000) }))
        }
      : undefined
  });
  if (handedOff) return;

  const textChannel = (interaction.channel ?? interaction.guild.systemChannel) as TextChannel | null;
  const queued: EnqueueResult[] = [];
  const lines: string[] = [];
  for (const record of records) {
    const query = replayQuery(record);
    try {
      const result = await enqueue({ guild: interaction.guild, member, voiceChannel: member.voice.channel, textChannel, query });
      queued.push(result);
      const { title, url } = result.track;
      lines.push(`➕ ${isHttpUrl(url) ? `[${linkLabel(title, 70)}](${url})` : safeText(title, 70)}`);
    } catch (error) {
      if (error instanceof PlayRejection) {
        lines.push(playRejectionMessage(error, query));
        if (isRequesterRejection(error)) break;
        continue;
      }
      console.warn("[history] Play again failed:", (error as Error)?.message ?? error);
      lines.push(`${playErrorMessage(error, query)} · ${safeText(record.title, 60)}`);
    }
  }

  if (records.length === 1 && queued.length === 1) {
    const [result] = queued;
    return privately(interaction, { components: [buildPlayReply(result, result.track.url, result.qualityBadge)], flags: V2 });
  }
  return privately(interaction, { content: truncate(lines.join("\n"), 2000) });
}

registerComponentHandler("history", async (interaction, args) => {
  if (!interaction.inCachedGuild()) return;
  const [action, pageArg, userArg] = args;
  const page = Math.max(0, Number(pageArg) || 0);
  const userId = /^\d{15,25}$/.test(userArg ?? "") ? userArg : null;

  if (action === "again" && interaction.isStringSelectMenu()) {
    return playAgain(interaction, page, userId);
  }
  if (action === "page" && interaction.isButton()) {
    await interaction.deferUpdate();
    try {
      const view = await buildHistoryView(interaction.guildId, page, userId);
      return interaction.editReply({ ...view, allowedMentions: NO_MENTIONS } as any);
    } catch (error) {
      console.warn("[history] Page failed:", (error as Error)?.message ?? error);
      return privately(interaction, { content: unavailable() });
    }
  }
});

/** /history — what played in this server lately, with "Play again". */
export default {
  data: new SlashCommandBuilder()
    .setName("history")
    .setDescription(i18n.__("history.description"))
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription(i18n.__("history.optionUser"))
        .setDescriptionLocalizations(descriptionLocalizations("history.optionUser") ?? {})
    ),
  cooldown: 3,
  category: "queue",

  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    const userId = interaction.options.getUser("user")?.id ?? null;
    if (!PlayHistoryService.getInstance().isAvailable()) {
      return interaction.reply({ content: unavailable(), flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();
    try {
      const view = await buildHistoryView(interaction.guildId, 0, userId);
      return interaction.editReply({ ...view, flags: V2, allowedMentions: NO_MENTIONS } as any);
    } catch (error) {
      console.warn("[history] Could not read the history:", (error as Error)?.message ?? error);
      return interaction.editReply({ content: unavailable() }).catch(console.error);
    }
  }
};
