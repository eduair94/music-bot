import { GuildQueue } from "discord-player";
import { ChannelType, Client, Guild, TextChannel, VoiceBasedChannel } from "discord.js";
import { localeForGuild } from "../utils/guildLocale";
import { i18n, runWithLocale } from "../utils/i18n";
import { hasPremiumFeature } from "../utils/premiumCheck";
import { DiscordPlayerService, QueueMetadata } from "./discordPlayer";
import { GuildSettingsService } from "./guildSettings";

const SWEEP_MS = 15 * 60 * 1000;

/**
 * 24/7 mode: the bot stays in its voice channel when the queue ends or the
 * channel empties, and rejoins that channel after a restart. It runs on the
 * entitlement of the member who turned it on (Founder, or an active vote);
 * a periodic sweep turns it off when that runs out.
 */
export class Stay247Service {
  private static instance: Stay247Service;
  private client: Client | null = null;

  public static getInstance(): Stay247Service {
    if (!this.instance) this.instance = new Stay247Service();
    return this.instance;
  }

  public async start(client: Client): Promise<void> {
    this.client = client;
    await this.restoreAll().catch((error) => console.error("[24/7] Restore failed:", error));
    setInterval(() => void this.sweep().catch((error) => console.error("[24/7] Sweep failed:", error)), SWEEP_MS).unref();
  }

  /** Apply or lift 24/7 on a live queue. */
  public applyToQueue(queue: GuildQueue, enabled: boolean, leaveTimeoutSec = 300, autoLeaveEmpty = true): void {
    const metadata = (queue.metadata || {}) as QueueMetadata;
    metadata.stay247 = enabled;
    queue.metadata = metadata;
    const options = queue.options as any;
    options.leaveOnEmpty = !enabled && autoLeaveEmpty;
    options.leaveOnEnd = !enabled;
    options.leaveOnStop = !enabled;
    options.leaveOnEmptyCooldown = leaveTimeoutSec * 1000;
    options.leaveOnEndCooldown = leaveTimeoutSec * 1000;
  }

  /** Create (or reuse) a queue connected to `voice`, with 24/7 applied. */
  private async connect(guild: Guild, voice: VoiceBasedChannel, text: TextChannel | null): Promise<GuildQueue | null> {
    const player = DiscordPlayerService.getInstance().getPlayer();
    if (!player) return null;
    let queue = player.nodes.get(guild.id);
    if (!queue) {
      const settings = await GuildSettingsService.getInstance().getSettings(guild.id);
      const metadata: QueueMetadata = { channel: text ?? undefined, stay247: true, autoplay: Boolean(settings.autoplay) };
      queue = player.nodes.create(guild, {
        metadata,
        leaveOnEmpty: false,
        leaveOnEnd: false,
        leaveOnStop: false,
        pauseOnEmpty: true,
        selfDeaf: true,
        volume: Math.min(settings.maxVolume ?? 100, settings.defaultVolume ?? 80),
        bufferingTimeout: 3_000,
        connectionTimeout: 120_000
      });
    }
    this.applyToQueue(queue, true);
    if (!queue.connection) await queue.connect(voice, { deaf: true });
    return queue;
  }

  public async enable(guild: Guild, voice: VoiceBasedChannel, text: TextChannel | null, userId: string): Promise<void> {
    await GuildSettingsService.getInstance().updateSettings(guild.id, {
      stay247: {
        enabled: true,
        voiceChannelId: voice.id,
        textChannelId: text?.id ?? null,
        enabledBy: userId,
        enabledAt: new Date()
      }
    });
    await this.connect(guild, voice, text);
  }

  public async disable(guild: Guild): Promise<void> {
    const service = GuildSettingsService.getInstance();
    const settings = await service.getSettings(guild.id);
    await service.updateSettings(guild.id, {
      stay247: { enabled: false, voiceChannelId: null, textChannelId: null, enabledBy: null, enabledAt: null }
    });
    const queue = DiscordPlayerService.getInstance().getQueue(guild.id);
    if (!queue) return;
    this.applyToQueue(queue, false, settings.autoLeaveTimeout ?? 300, settings.autoLeaveEmpty ?? true);
    // Nothing playing and nobody waiting: leave now instead of idling forever.
    if (!queue.currentTrack && queue.tracks.size === 0) queue.delete();
  }

  private async entitled(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;
    try {
      return await hasPremiumFeature(userId, "stay_24_7");
    } catch {
      // Patreon/DB hiccup: don't kick a paying server out over a transient error.
      return true;
    }
  }

  private async restoreAll(): Promise<void> {
    if (!this.client) return;
    const guilds = await GuildSettingsService.getInstance().getStay247Guilds();
    let restored = 0;
    for (const settings of guilds) {
      const guild = this.client.guilds.cache.get(settings.guildId);
      if (!guild || !settings.stay247?.voiceChannelId) continue;
      if (!(await this.entitled(settings.stay247.enabledBy))) {
        await this.turnOffLost(guild, settings.stay247.textChannelId);
        continue;
      }
      const voice = guild.channels.cache.get(settings.stay247.voiceChannelId);
      if (!voice || !voice.isVoiceBased()) continue;
      const textRaw = settings.stay247.textChannelId ? guild.channels.cache.get(settings.stay247.textChannelId) : null;
      const text = textRaw && textRaw.type === ChannelType.GuildText ? (textRaw as TextChannel) : null;
      try {
        await this.connect(guild, voice, text);
        restored++;
      } catch (error) {
        console.warn(`[24/7] Could not rejoin ${guild.name}:`, (error as Error)?.message ?? error);
      }
      // Stagger voice joins so a restart doesn't burst the gateway.
      await new Promise((r) => setTimeout(r, 1500));
    }
    if (guilds.length) console.log(`[24/7] ✅ Rejoined ${restored}/${guilds.length} servers`);
  }

  private async sweep(): Promise<void> {
    if (!this.client) return;
    const guilds = await GuildSettingsService.getInstance().getStay247Guilds();
    for (const settings of guilds) {
      const guild = this.client.guilds.cache.get(settings.guildId);
      if (!guild) continue;
      if (!(await this.entitled(settings.stay247?.enabledBy))) {
        await this.turnOffLost(guild, settings.stay247?.textChannelId ?? null);
      }
    }
  }

  private async turnOffLost(guild: Guild, textChannelId: string | null | undefined): Promise<void> {
    await this.disable(guild);
    console.log(`[24/7] Turned off in ${guild.name}: entitlement ended`);
    const channel = textChannelId ? guild.channels.cache.get(textChannelId) : null;
    if (channel && channel.isTextBased() && "send" in channel) {
      const locale = await localeForGuild(guild);
      await channel.send({ content: `🌙 ${runWithLocale(locale, () => i18n.__("stay247.lost"))}`, allowedMentions: { parse: [] } }).catch(() => undefined);
    }
  }
}
