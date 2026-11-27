import { randomBytes } from "node:crypto";
import {
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  GuildMember,
  MessageFlags,
  PermissionsBitField,
  SeparatorSpacingSize,
  SlashCommandBuilder
} from "discord.js";
import type { ICollection, ICollectionTrack } from "../models/Collection";
import { aiAccess, consumeQuota, genBucket, refundQuota } from "../services/ai/aiAccess";
import { ClaudeCallError, claudeCredits } from "../services/ai/claudeCredits";
import { AiPlaylist, generatePlaylist, MAX_AI_TRACKS, MAX_PROMPT_LENGTH, MIN_AI_TRACKS, songLine } from "../services/ai/playlistGenerator";
import { collectionService } from "../services/collection";
import { loadCollection } from "../services/collectionPlayback";
import { DatabaseService } from "../services/database";
import { canManageServerPlaylists, serverOwnerKey } from "../services/serverPlaylists";
import { registerComponentHandler } from "../structs/componentRouter";
import { aiFailureMessage, aiQuotaMessage, aiTrialNote, publicReply } from "../utils/aiReplies";
import { safeText, truncate } from "../utils/format";
import { currentLocale, descriptionLocalizations, i18n } from "../utils/i18n";
import { startAiRadio } from "./radio";

/**
 * /ai — the AI DJ (Claude, on the owner's plan credits).
 *
 *   /ai playlist <prompt> [count] [play] [next] — a playlist for a
 *     description, queued right away (or just shown), with buttons to save
 *     it to your collections or as a server playlist.
 *   /ai radio <prompt> — endless AI radio (same as /radio prompt:).
 *
 * Premium servers and members get AI_PREMIUM_DAILY uses per server per day;
 * everyone else gets a small daily trial (services/ai/aiAccess.ts).
 */

const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const ACCENT = 0x8b5cf6;
const SHOWN_TRACKS = 20;

/** Generated playlists kept for the Save / Play buttons (in memory; lost on restart). */
interface Pending {
  playlist: AiPlaylist;
  prompt: string;
  userId: string;
  guildId: string;
  at: number;
}
const pending = new Map<string, Pending>();
const PENDING_TTL_MS = 6 * 60 * 60 * 1000;
const PENDING_MAX = 500;

function remember(entry: Pending): string {
  const now = Date.now();
  for (const [id, p] of pending) if (now - p.at > PENDING_TTL_MS || pending.size >= PENDING_MAX) pending.delete(id);
  const id = randomBytes(6).toString("base64url");
  pending.set(id, entry);
  return id;
}

/** AI songs as stored collection tracks, matched on YouTube when they play. */
export function aiCollectionTracks(playlist: AiPlaylist, userId: string): ICollectionTrack[] {
  return playlist.tracks.map((t) => ({
    title: t.title,
    author: t.artist,
    url: `ytsearch1:${songLine(t)} audio`,
    duration: 0,
    addedAt: new Date(),
    addedBy: userId
  }));
}

/** An unsaved collection-shaped object, so the collection loader can queue it. */
function asCollection(id: string, entry: Pending): ICollection {
  return {
    _id: `ai-${id}`,
    userId: entry.userId,
    name: entry.playlist.title,
    description: entry.playlist.description,
    tracks: aiCollectionTracks(entry.playlist, entry.userId),
    isPublic: false,
    createdAt: new Date(entry.at),
    updatedAt: new Date(entry.at)
  } as unknown as ICollection;
}

function buildCard(id: string, entry: Pending, options: { notice?: string; showPlay: boolean }): ContainerBuilder {
  const { playlist } = entry;
  const container = new ContainerBuilder().setAccentColor(ACCENT);
  const head = [`### 🤖 ${safeText(playlist.title, 80)}`];
  if (playlist.description) head.push(safeText(playlist.description, 200));
  head.push(`-# ${i18n.__mf("ai.card.prompt", { prompt: safeText(truncate(entry.prompt, 150), 150) })}`);
  container.addTextDisplayComponents((t) => t.setContent(head.join("\n")));
  container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  const lines = playlist.tracks
    .slice(0, SHOWN_TRACKS)
    .map((t, i) => `\`${String(i + 1).padStart(2, " ")}.\` ${safeText(t.title, 60)} · ${safeText(t.artist, 40)}`);
  if (playlist.tracks.length > SHOWN_TRACKS) lines.push(i18n.__mf("ai.card.more", { count: playlist.tracks.length - SHOWN_TRACKS }));
  container.addTextDisplayComponents((t) => t.setContent(lines.join("\n")));
  if (options.notice) container.addTextDisplayComponents((t) => t.setContent(`-# ${options.notice}`));

  const buttons: ButtonBuilder[] = [];
  if (options.showPlay) {
    buttons.push(new ButtonBuilder().setCustomId(`ai:play:${id}`).setLabel(i18n.__("ai.card.play")).setEmoji("▶️").setStyle(ButtonStyle.Primary));
  }
  buttons.push(
    new ButtonBuilder().setCustomId(`ai:save:${id}`).setLabel(i18n.__("ai.card.save")).setEmoji("💾").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ai:server:${id}`).setLabel(i18n.__("ai.card.saveServer")).setEmoji("📁").setStyle(ButtonStyle.Secondary)
  );
  container.addActionRowComponents((row) => row.setComponents(...buttons));
  return container;
}

/** A free name for `base` among the owner's collections ("Rainy Jazz", "Rainy Jazz (2)"…). */
async function freeName(owner: string, base: string): Promise<string> {
  const name = truncate(base.trim() || "AI Mix", 90);
  if (!(await collectionService.getByName(owner, name))) return name;
  for (let n = 2; n < 50; n++) {
    const candidate = `${name} (${n})`;
    if (!(await collectionService.getByName(owner, candidate))) return candidate;
  }
  return `${name} ${Date.now().toString(36)}`;
}

registerComponentHandler("ai", async (interaction, args) => {
  if (!interaction.inCachedGuild() || !interaction.isButton()) return;
  const [action, id] = args;
  const entry = pending.get(id);
  if (!entry) return interaction.reply({ content: `⌛ ${i18n.__("ai.expired")}`, flags: EPHEMERAL });

  if (action === "play") {
    return loadCollection(interaction, asCollection(id, entry), "end", false);
  }
  if (!DatabaseService.getInstance().isReady()) return interaction.reply({ content: `⚠️ ${i18n.__("collections.error")}`, flags: EPHEMERAL });

  if (action === "save" || action === "server") {
    const toServer = action === "server";
    await interaction.deferReply(toServer ? {} : { flags: EPHEMERAL });
    if (toServer && !(await canManageServerPlaylists(interaction.member as GuildMember))) {
      return interaction.editReply({ content: `🔒 ${i18n.__("playlists.needDj")}` });
    }
    const owner = toServer ? serverOwnerKey(interaction.guildId) : interaction.user.id;
    if (!(await collectionService.canCreateCollection(owner))) {
      return interaction.editReply({ content: i18n.__(toServer ? "playlists.limitReached" : "collections.create.limitReached") });
    }
    const name = await freeName(owner, entry.playlist.title);
    try {
      await collectionService.createFromTracks(owner, name, aiCollectionTracks(entry.playlist, interaction.user.id));
    } catch (error) {
      // A double click raced the first save to the same free name.
      if ((error as { code?: number })?.code !== 11000) throw error;
      return interaction.editReply({ content: i18n.__mf("collections.create.exists", { name: safeText(name, 100) }), allowedMentions: { parse: [] } });
    }
    const line = toServer
      ? `📁 ${i18n.__mf("ai.savedServer", { name: safeText(name, 100) })}`
      : `💾 ${i18n.__mf("ai.saved", { name: safeText(name, 100) })}`;
    return interaction.editReply({ content: line, allowedMentions: { parse: [] } });
  }
  return interaction.reply({ content: i18n.__("router.expired"), flags: EPHEMERAL });
});

function described<T extends { setDescription(text: string): T; setDescriptionLocalizations(map: Record<string, string> | null): T }>(
  builder: T,
  key: string
): T {
  return builder.setDescription(i18n.__(key)).setDescriptionLocalizations(descriptionLocalizations(key) ?? null);
}

export default {
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription(i18n.__("ai.description"))
    .setDescriptionLocalizations(descriptionLocalizations("ai.description") ?? null)
    .addSubcommand((sub) =>
      described(sub.setName("playlist"), "ai.playlist.description")
        .addStringOption((opt) => described(opt.setName("prompt"), "ai.promptOption").setRequired(true).setMaxLength(MAX_PROMPT_LENGTH))
        .addIntegerOption((opt) =>
          described(opt.setName("count"), "ai.playlist.countOption").setMinValue(MIN_AI_TRACKS).setMaxValue(MAX_AI_TRACKS)
        )
        .addBooleanOption((opt) => described(opt.setName("play"), "ai.playlist.playOption"))
        .addBooleanOption((opt) => described(opt.setName("next"), "ai.playlist.nextOption"))
    )
    .addSubcommand((sub) =>
      described(sub.setName("radio"), "ai.radio.description").addStringOption((opt) =>
        described(opt.setName("prompt"), "ai.promptOption").setRequired(true).setMaxLength(MAX_PROMPT_LENGTH)
      )
    ),
  cooldown: 10,
  category: "music",
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  /** Hidden until a Claude key is configured. */
  isAvailable: () => claudeCredits().configured,

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) return;
    const prompt = interaction.options.getString("prompt", true).trim();
    if (interaction.options.getSubcommand() === "radio") return startAiRadio(interaction, prompt);
    return makePlaylist(interaction, prompt);
  }
};

async function makePlaylist(interaction: ChatInputCommandInteraction<"cached">, prompt: string) {
  const count = interaction.options.getInteger("count") ?? 20;
  const play = interaction.options.getBoolean("play") ?? true;
  const next = interaction.options.getBoolean("next") ?? false;
  const member = interaction.member as GuildMember;

  if (play && !member.voice.channel) {
    return interaction.reply({ content: `🔇 ${i18n.__("ai.notInVoice")}`, flags: EPHEMERAL });
  }
  // Premium and quota lookups hit Mongo and Discord: defer first (3-second deadline).
  await interaction.deferReply();
  const access = await aiAccess(interaction.user.id, interaction.guildId);
  const bucket = genBucket(access);
  if (!(await consumeQuota(bucket, interaction.guildId, access.daily))) {
    return interaction.editReply(publicReply(aiQuotaMessage(access)));
  }

  let playlist: AiPlaylist;
  try {
    playlist = await generatePlaylist({ prompt, count, language: currentLocale(), feature: "ai_playlist" });
  } catch (error) {
    await refundQuota(bucket, interaction.guildId, access);
    const reason = error instanceof ClaudeCallError ? error.reason : "error";
    if (reason === "error") console.error("[ai] playlist failed:", error);
    return interaction.editReply({ content: aiFailureMessage(reason) });
  }

  const entry: Pending = { playlist, prompt, userId: interaction.user.id, guildId: interaction.guildId, at: Date.now() };
  const id = remember(entry);
  const notice = await aiTrialNote(access, interaction.guildId);
  const card = buildCard(id, entry, { notice: notice ?? undefined, showPlay: !play });

  if (!play) {
    return interaction.editReply({ components: [card], flags: V2, allowedMentions: { parse: [] } } as any);
  }
  // The loader answers in the deferred reply (queued / why not); the card follows it.
  await loadCollection(interaction, asCollection(id, entry), next ? "next" : "end", false);
  await interaction.followUp({ components: [card], flags: V2, allowedMentions: { parse: [] } } as any).catch((error) => {
    console.error("[ai] Could not send the playlist card:", (error as Error)?.message ?? error);
  });
}
