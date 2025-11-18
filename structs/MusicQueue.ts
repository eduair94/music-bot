import {
  AudioPlayer,
  AudioPlayerPlayingState,
  AudioPlayerState,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  entersState,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionState,
  VoiceConnectionStatus
} from "@discordjs/voice";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CommandInteraction,
  GuildMember,
  Interaction,
  Message,
  TextChannel
} from "discord.js";
import { promisify } from "node:util";
import { bot } from "../index";
import { QueueOptions } from "../interfaces/QueueOptions";
import { config } from "../utils/config";
import { i18n } from "../utils/i18n";
import { canModifyQueue } from "../utils/queue";
import { safeReply } from "../utils/safeReply";
import { Song } from "./Song";

const wait = promisify(setTimeout);

export class MusicQueue {
  public readonly interaction: CommandInteraction;
  public readonly connection: VoiceConnection;
  public readonly player: AudioPlayer;
  public readonly textChannel: TextChannel;
  public readonly bot = bot;

  public resource: AudioResource;
  public songs: Song[] = [];
  public volume = config.DEFAULT_VOLUME || 100;
  public loop = false;
  public muted = false;
  public waitTimeout: NodeJS.Timeout | null;
  private queueLock = false;
  private readyLock = false;
  private stopped = false;

  /**
   * Constructs a new MusicQueue instance, setting up the audio player,
   * voice connection, and event listeners to manage voice state changes
   * and audio playback. It also handles network state changes to ensure
   * a stable connection for audio streaming.
   * @param options
   */
  public constructor(options: QueueOptions) {
    Object.assign(this, options);

    this.player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    this.connection.subscribe(this.player);

    const networkStateChangeHandler = (
      oldNetworkState: VoiceConnectionState,
      newNetworkState: VoiceConnectionState
    ) => {
      const newUdp = Reflect.get(newNetworkState, "udp");
      clearInterval(newUdp?.keepAliveInterval);
    };

    this.connection.on("stateChange", async (oldState: VoiceConnectionState, newState: VoiceConnectionState) => {
      console.log(`[MusicQueue] 🔊 Connection state: ${oldState.status} -> ${newState.status}`);
      
      Reflect.get(oldState, "networking")?.off("stateChange", networkStateChangeHandler);
      Reflect.get(newState, "networking")?.on("stateChange", networkStateChangeHandler);

      if (newState.status === VoiceConnectionStatus.Disconnected) {
        console.log(`[MusicQueue] ❌ DISCONNECTED - Reason: ${newState.reason}, Close code: ${(newState as any).closeCode || 'N/A'}`);
        console.log(`[MusicQueue] 📊 Rejoin attempts: ${this.connection.rejoinAttempts}/5`);
        
        if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && (newState as any).closeCode === 4014) {
          console.log(`[MusicQueue] 🛑 WebSocket close 4014 - Stopping playback`);
          try {
            this.stop();
          } catch (e) {
            console.log(`[MusicQueue] ⚠️ Error stopping:`, e);
            this.stop();
          }
        } else if (this.connection.rejoinAttempts < 5) {
          console.log(`[MusicQueue] 🔄 Attempting to rejoin in ${(this.connection.rejoinAttempts + 1) * 5} seconds...`);
          await wait((this.connection.rejoinAttempts + 1) * 5_000);
          this.connection.rejoin();
        } else {
          console.log(`[MusicQueue] 💀 Max rejoin attempts reached - Destroying connection`);
          this.connection.destroy();
        }
      } else if (
        !this.readyLock &&
        (newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)
      ) {
        this.readyLock = true;
        console.log(`[MusicQueue] 🔒 Waiting for connection to be ready...`);
        try {
          await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000); // Increased from 20s to 30s
          console.log(`[MusicQueue] ✅ Connection is ready!`);
        } catch {
          console.log(`[MusicQueue] ⏰ Connection ready timeout - Destroying connection`);
          if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            try {
              this.connection.destroy();
            } catch {}
          }
        } finally {
          this.readyLock = false;
        }
      }
    });

    this.player.on("stateChange", async (oldState: AudioPlayerState, newState: AudioPlayerState) => {
      console.log(`[MusicQueue] 🎵 Player state: ${oldState.status} -> ${newState.status}`);
      
      if (oldState.status !== AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Idle) {
        console.log(`[MusicQueue] 🔚 Song finished playing`);
        
        if (this.loop && this.songs.length) {
          console.log(`[MusicQueue] 🔁 Loop enabled - Re-queuing song`);
          this.songs.push(this.songs.shift()!);
        } else {
          console.log(`[MusicQueue] ⏭️ Moving to next song`);
          this.songs.shift();
          if (!this.songs.length) {
            console.log(`[MusicQueue] 📭 Queue empty - Stopping`);
            return this.stop();
          }
        }

        if (this.songs.length || this.resource.audioPlayer) {
          console.log(`[MusicQueue] 📋 Processing next in queue (${this.songs.length} songs remaining)`);
          this.processQueue();
        }
      } else if (oldState.status === AudioPlayerStatus.Buffering && newState.status === AudioPlayerStatus.Playing) {
        console.log(`[MusicQueue] ▶️ Started playing - Sending "Now Playing" message`);
        this.sendPlayingMessage(newState);
      }
    });

    this.player.on("error", (error) => {
      console.error("[MusicQueue] ❌ Player error occurred!");
      console.error("[MusicQueue] 🔴 Error message:", error.message);
      console.error("[MusicQueue] 📄 Error resource metadata:", error.resource?.metadata);
      console.error("[MusicQueue] 📚 Full error:", error);

      if (this.loop && this.songs.length) {
        console.log(`[MusicQueue] 🔁 Error occurred but loop enabled - Re-queuing song`);
        this.songs.push(this.songs.shift()!);
      } else {
        console.log(`[MusicQueue] ⏭️ Error occurred - Skipping to next song`);
        this.songs.shift();
      }

      console.log(`[MusicQueue] 🔄 Processing queue after error (${this.songs.length} songs remaining)`);
      this.processQueue();
    });
  }

  public enqueue(...songs: Song[]) {
    console.log(`[MusicQueue] ➕ Enqueuing ${songs.length} song(s)`);
    
    if (this.waitTimeout !== null) {
      console.log(`[MusicQueue] ⏰ Clearing wait timeout`);
      clearTimeout(this.waitTimeout);
    }
    this.waitTimeout = null;
    this.stopped = false;
    
    this.songs = this.songs.concat(songs);
    console.log(`[MusicQueue] 📋 Queue now has ${this.songs.length} song(s)`);
    
    this.processQueue();
  }

  public stop() {
    console.log(`[MusicQueue] 🛑 Stop called (already stopped: ${this.stopped})`);
    
    if (this.stopped) return;

    this.stopped = true;
    this.loop = false;
    this.songs = [];
    
    console.log(`[MusicQueue] ⏹️ Stopping player`);
    this.player.stop();

    !config.PRUNING && this.textChannel.send(i18n.__("play.queueEnded")).catch(console.error);

    if (this.waitTimeout !== null) {
      console.log(`[MusicQueue] ⏰ Wait timeout already exists - not creating new one`);
      return;
    }

    console.log(`[MusicQueue] ⏰ Setting wait timeout for ${config.STAY_TIME} seconds`);
    this.waitTimeout = setTimeout(() => {
      console.log(`[MusicQueue] 💀 Wait timeout expired - Destroying connection`);
      if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
        try {
          this.connection.destroy();
        } catch {}
      }
      bot.queues.delete(this.interaction.guild!.id);

      !config.PRUNING && this.textChannel.send(i18n.__("play.leaveChannel"));
    }, config.STAY_TIME * 1000);
  }

  /**
   * Processes the song queue for playback. This method checks if the queue is locked or if the player
   * is busy. If not, it proceeds to play the next song in the queue. This method is also responsible
   * for handling playback errors and retrying song playback when necessary. It ensures that the queue
   * continues to play smoothly, handling transitions between songs, including loop and stop behaviors.
   */
  public async processQueue(): Promise<void> {
    console.log(`[MusicQueue] 🔄 processQueue called - queueLock: ${this.queueLock}, player status: ${this.player.state.status}`);
    
    if (this.queueLock || this.player.state.status !== AudioPlayerStatus.Idle) {
      console.log(`[MusicQueue] 🚫 Queue locked or player busy - skipping`);
      return;
    }

    if (!this.songs.length) {
      console.log(`[MusicQueue] 📭 No songs in queue - stopping`);
      return this.stop();
    }

    console.log(`[MusicQueue] 🔒 Locking queue`);
    this.queueLock = true;

    const next = this.songs[0];
    console.log(`[MusicQueue] 🎵 Next song: "${next.title}" (${next.duration}s) from ${next.url}`);

    try {
      // Ensure the voice connection is ready before attempting to play
      if (this.connection.state.status !== VoiceConnectionStatus.Ready) {
        console.log("[MusicQueue] 🔒 Waiting for voice connection to be ready...");
        try {
          await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
          console.log("[MusicQueue] ✅ Voice connection ready!");
        } catch (error) {
          console.error("[MusicQueue] ⏰ Voice connection failed to become ready:", error);
          this.textChannel.send("❌ Failed to establish voice connection. Please try again.").catch(console.error);
          this.queueLock = false;
          return this.stop();
        }
      }

      // Send a loading message for user feedback
      console.log(`[MusicQueue] 💬 Sending loading message`);
      const loadingMsg = await this.textChannel.send(`⏳ Preparing to play: **${next.title}**...`).catch(console.error);
      
      console.log(`[MusicQueue] 🎧 Creating audio resource for ${next.title}`);
      const resource = await next.makeResource();
      
      // Check if resource was created successfully
      if (!resource) {
        console.error(`[MusicQueue] ❌ Failed to create audio resource for ${next.title}`);
        if (loadingMsg) {
          await loadingMsg.delete().catch(console.error);
        }
        throw new Error("Failed to create audio resource");
      }
      
      console.log(`[MusicQueue] ✅ Audio resource created successfully`);
      
      // Delete the loading message once ready
      if (loadingMsg) {
        console.log(`[MusicQueue] 🗑️ Deleting loading message`);
        await loadingMsg.delete().catch(console.error);
      }
      
      this.resource = resource;
      console.log(`[MusicQueue] ▶️ Starting playback`);
      this.player.play(this.resource);
      this.resource.volume?.setVolumeLogarithmic(this.volume / 100);
      console.log(`[MusicQueue] 🔊 Volume set to ${this.volume}%`);
    } catch (error) {
      console.error("[MusicQueue] ❌ Error in processQueue:", error);
      
      // Inform user of the error
      this.textChannel.send(`❌ Failed to play: **${next.title}**. Skipping to next song...`).catch(console.error);

      console.log(`[MusicQueue] 🔄 Retrying processQueue after error`);
      return this.processQueue();
    } finally {
      console.log(`[MusicQueue] 🔓 Unlocking queue`);
      this.queueLock = false;
    }
  }

  private async handleSkip(interaction: ButtonInteraction): Promise<void> {
    await this.bot.slashCommandsMap.get("skip")!.execute(interaction);
  }

  private async handlePlayPause(interaction: ButtonInteraction): Promise<void> {
    if (this.player.state.status === AudioPlayerStatus.Playing) {
      await this.bot.slashCommandsMap.get("pause")!.execute(interaction);
    } else {
      await this.bot.slashCommandsMap.get("resume")!.execute(interaction);
    }
  }

  private async handleMute(interaction: ButtonInteraction): Promise<void> {
    if (!canModifyQueue(interaction.member as GuildMember)) return;

    this.muted = !this.muted;

    if (this.muted) {
      this.resource.volume?.setVolumeLogarithmic(0);

      safeReply(interaction, i18n.__mf("play.mutedSong", { author: interaction.user })).catch(console.error);
    } else {
      this.resource.volume?.setVolumeLogarithmic(this.volume / 100);

      safeReply(interaction, i18n.__mf("play.unmutedSong", { author: interaction.user })).catch(console.error);
    }
  }

  private async handleDecreaseVolume(interaction: ButtonInteraction): Promise<void> {
    if (this.volume == 0) return;

    if (!canModifyQueue(interaction.member as GuildMember)) return;

    this.volume = Math.max(this.volume - 10, 0);

    this.resource.volume?.setVolumeLogarithmic(this.volume / 100);

    safeReply(interaction, i18n.__mf("play.decreasedVolume", { author: interaction.user, volume: this.volume })).catch(
      console.error
    );
  }

  private async handleIncreaseVolume(interaction: ButtonInteraction): Promise<void> {
    if (this.volume == 500) return;

    if (!canModifyQueue(interaction.member as GuildMember)) return;

    this.volume = Math.min(this.volume + 10, 500);

    this.resource.volume?.setVolumeLogarithmic(this.volume / 100);

    safeReply(interaction, i18n.__mf("play.increasedVolume", { author: interaction.user, volume: this.volume })).catch(
      console.error
    );
  }

  private async handleLoop(interaction: ButtonInteraction): Promise<void> {
    await this.bot.slashCommandsMap.get("loop")!.execute(interaction);
  }

  private async handleShuffle(interaction: ButtonInteraction): Promise<void> {
    await this.bot.slashCommandsMap.get("shuffle")!.execute(interaction);
  }

  private async handleStop(interaction: ButtonInteraction): Promise<void> {
    await this.bot.slashCommandsMap.get("stop")!.execute(interaction);
  }

  private commandHandlers = new Map([
    ["skip", this.handleSkip],
    ["play_pause", this.handlePlayPause],
    ["mute", this.handleMute],
    ["decrease_volume", this.handleDecreaseVolume],
    ["increase_volume", this.handleIncreaseVolume],
    ["loop", this.handleLoop],
    ["shuffle", this.handleShuffle],
    ["stop", this.handleStop]
  ]);

  private createButtonRow() {
    const firstRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("skip").setLabel("⏭").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("play_pause").setLabel("⏯").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("mute").setLabel("🔇").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("decrease_volume").setLabel("🔉").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("increase_volume").setLabel("🔊").setStyle(ButtonStyle.Secondary)
    );
    const secondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("loop").setLabel("🔁").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("shuffle").setLabel("🔀").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("stop").setLabel("⏹").setStyle(ButtonStyle.Secondary)
    );

    return [firstRow, secondRow];
  }

  /**
   * Sets up a message component collector for the playing message to handle
   * button interactions. This collector listens for button clicks and dispatches
   * commands based on the custom ID of the clicked button. It supports functionalities
   * like skip, stop, play/pause, volume control, and more. The collector is also
   * responsible for stopping itself when the corresponding song is skipped or stopped,
   * ensuring that interactions are only valid for the current playing song.
   */
  private async sendPlayingMessage(newState: AudioPlayerPlayingState) {
    const song = (newState.resource as AudioResource<Song>).metadata;
    console.log(`[MusicQueue] 💬 Sending "Now Playing" message for: ${song.title}`);

    let playingMessage: Message;

    try {
      playingMessage = await this.textChannel.send({
        content: song.startMessage(),
        components: this.createButtonRow()
      });
      console.log(`[MusicQueue] ✅ "Now Playing" message sent (ID: ${playingMessage.id})`);
    } catch (error: unknown) {
      console.error("[MusicQueue] ❌ Failed to send playing message:", error);
      if (error instanceof Error) this.textChannel.send(error.message);
      return;
    }

    const filter = (i: Interaction) => i.isButton() && i.message.id === playingMessage.id;

    // Calculate collector timeout - use 1 hour if duration is 0 or invalid
    const collectorTimeout = song.duration > 0 ? song.duration * 1000 : 3600000; // 1 hour default
    console.log(`[MusicQueue] ⏱️ Collector timeout: ${collectorTimeout}ms (song duration: ${song.duration}s)`);

    const collector = playingMessage.createMessageComponentCollector({
      filter,
      time: collectorTimeout
    });

    collector.on("collect", async (interaction) => {
      console.log(`[MusicQueue] 🔘 Button interaction: ${interaction.customId}`);
      
      if (!interaction.isButton()) return;
      if (!this.songs) return;

      const handler = this.commandHandlers.get(interaction.customId);

      if (["skip", "stop"].includes(interaction.customId)) {
        console.log(`[MusicQueue] 🛑 Stopping collector due to ${interaction.customId}`);
        collector.stop();
      }

      if (handler) {
        console.log(`[MusicQueue] ⚡ Executing handler for ${interaction.customId}`);
        await handler.call(this, interaction);
      }
    });

    collector.on("end", (collected, reason) => {
      console.log(`[MusicQueue] 🏁 Collector ended - Reason: ${reason}, Collected: ${collected.size} interactions`);
      
      // Remove the buttons when the song ends
      playingMessage.edit({ components: [] }).catch(console.error);

      // Delete the message if pruning is enabled
      if (config.PRUNING) {
        console.log(`[MusicQueue] 🗑️ Pruning enabled - Deleting message in 3s`);
        setTimeout(() => {
          playingMessage.delete().catch();
        }, 3000);
      }
    });
  }
}
