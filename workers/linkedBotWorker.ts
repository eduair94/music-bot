/**
 * Linked Bot Worker
 * 
 * This is a worker process that runs a user-linked Discord bot.
 * It is spawned by the BotManagerService and receives configuration
 * via IPC messages from the parent process.
 * 
 * The worker:
 * - Connects to Discord using the provided bot token
 * - Initializes the music player
 * - Reports status back to parent via IPC
 * - Handles commands from parent (stop, restart, etc.)
 */

import { AttachmentExtractor, SoundCloudExtractor, SpotifyExtractor } from "@discord-player/extractor";
import { spawn } from "child_process";
import { GuildQueue, Player, Track, TrackSkipReason } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import {
    ApplicationCommandDataResolvable,
    ChatInputCommandInteraction,
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    Interaction,
    REST,
    Routes,
    Snowflake
} from "discord.js";
import fs from "fs";
import mongoose from "mongoose";
import path from "path";
import { Readable } from "stream";
import { Command } from "../interfaces/Command";
import { checkPermissions, PermissionResult } from "../utils/checkPermissions";
import { i18n } from "../utils/i18n";
import { MissingPermissionsException } from "../utils/MissingPermissionsException";

// Worker configuration received from parent
interface WorkerConfig {
    token: string;
    botId: string;
    ownerId: string;
    mongodbUri: string;
    allowedGuilds?: string[];
}

// Status messages to parent
interface StatusMessage {
    type: 'status' | 'error' | 'stats' | 'ready' | 'shutdown';
    status?: 'online' | 'offline' | 'error';
    error?: string;
    stats?: {
        guilds: number;
        songsPlayed: number;
        uptime: number;
    };
    botId?: string;
    botUsername?: string;
    botAvatar?: string;
}

// Global state
let config: WorkerConfig | null = null;
let client: Client | null = null;
let player: Player | null = null;
let startTime = Date.now();
let songsPlayed = 0;
let commands = new Collection<string, Command>();
let slashCommands = new Array<ApplicationCommandDataResolvable>();
let slashCommandsMap = new Collection<string, Command>();
let cooldowns = new Collection<string, Collection<Snowflake, number>>();

/**
 * Send message to parent process
 */
function sendToParent(message: StatusMessage): void {
    if (process.send) {
        process.send(message);
    }
}

/**
 * Initialize the Discord Player for music playback
 */
async function initializePlayer(): Promise<void> {
    if (!client) return;

    console.log("[LinkedBot] 🎵 Initializing discord-player...");

    player = new Player(client, {
        skipFFmpeg: false,
    });

    const hasCookies = fs.existsSync("./cookies.txt")
        && fs.statSync("./cookies.txt").isFile()
        && fs.statSync("./cookies.txt").size > 0;

    // Custom stream function using yt-dlp.
    // Return process.stdout IMMEDIATELY — no PassThrough, no waiting.
    // discord-player's FFmpeg pipeline pulls data as it arrives.
    const createYtDlpStream = async (track: Track): Promise<Readable> => {
        console.log(`[LinkedBot] 🎵 Creating stream for: ${track.title}`);

        if (!track.url) {
            throw new Error(`Track has no URL: ${track.title}`);
        }

        const cookieArgs = hasCookies ? ['--cookies', './cookies.txt'] : [];

        const ytdlpArgs = [
            '--format', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=opus]/bestaudio*/bestaudio/best',
            '--no-playlist',
            '--no-check-certificates',
            '--no-warnings',
            '--extractor-retries', '3',
            '--socket-timeout', '15',
            '--retries', '3',
            '--fragment-retries', '3',
            '--force-ipv4',
            '--geo-bypass',
            '--output', '-',
            ...cookieArgs,
            track.url,
        ];

        const proc = spawn('yt-dlp', ytdlpArgs, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stderrOutput = '';

        proc.stderr.on('data', (data: Buffer) => {
            const msg = data.toString().trim();
            stderrOutput += msg + '\n';
            if (msg.includes('ERROR') || msg.includes('error')) {
                console.error(`[LinkedBot] ⚠️ yt-dlp stderr: ${msg}`);
            }
        });

        proc.on('error', (err) => {
            console.error(`[LinkedBot] ❌ yt-dlp spawn error:`, err);
            proc.stdout.destroy(err);
        });

        proc.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                const errorLine = stderrOutput.split('\n').find(l => l.includes('ERROR'))?.trim()
                    || `yt-dlp exited with code ${code}`;
                console.error(`[LinkedBot] ❌ yt-dlp failed for: ${track.title} — ${errorLine}`);
                if (!proc.stdout.destroyed) {
                    proc.stdout.destroy(new Error(errorLine));
                }
            }
        });

        return proc.stdout as unknown as Readable;
    };

    // Register extractors
    await player.extractors.register(YoutubeiExtractor, {
        streamOptions: {
            useClient: "IOS",
            highWaterMark: 1024 * 1024 * 10, // 10MB buffer
        },
        createStream: createYtDlpStream,
    });

    await player.extractors.register(SpotifyExtractor, {});
    await player.extractors.register(SoundCloudExtractor, {});
    await player.extractors.register(AttachmentExtractor, {});

    // Track songs played
    player.events.on('playerStart', (queue: GuildQueue, track: Track) => {
        songsPlayed++;
        console.log(`[LinkedBot] ▶️ Now playing: ${track.title}`);
    });

    player.events.on('playerSkip', (queue: GuildQueue, track: Track, reason: TrackSkipReason) => {
        console.log(`[LinkedBot] ⏭️ Skipped: ${track.title} - ${reason}`);
    });

    player.events.on('error', (queue: GuildQueue, error: Error) => {
        console.error(`[LinkedBot] ❌ Player error:`, error);
    });

    console.log("[LinkedBot] ✅ Discord Player initialized");
}

/**
 * Load and register slash commands
 */
async function registerCommands(): Promise<void> {
    if (!client || !config) return;

    const rest = new REST({ version: "9" }).setToken(config.token);

    // Load commands from the commands directory
    const commandsPath = path.join(__dirname, "..", "commands");
    
    if (!fs.existsSync(commandsPath)) {
        console.error("[LinkedBot] Commands directory not found");
        return;
    }

    const commandFiles = fs.readdirSync(commandsPath).filter((file) => {
        const isValidExtension = file.endsWith(".ts") || file.endsWith(".js");
        const isNotMapFile = !file.endsWith(".map") && !file.endsWith(".d.ts");
        return isValidExtension && isNotMapFile;
    });

    for (const file of commandFiles) {
        try {
            const command = await import(path.join(commandsPath, file));

            if (command.default?.data) {
                slashCommands.push(command.default.data);
                slashCommandsMap.set(command.default.data.name, command.default);
            }
        } catch (error) {
            console.error(`[LinkedBot] Failed to load command ${file}:`, error);
        }
    }

    try {
        await rest.put(Routes.applicationCommands(client.user!.id), { body: slashCommands });
        console.log(`[LinkedBot] ✅ Registered ${slashCommands.length} commands`);
    } catch (error) {
        console.error("[LinkedBot] Failed to register commands:", error);
    }
}

/**
 * Set up interaction handler for slash commands
 */
function setupInteractionHandler(): void {
    if (!client) return;

    client.on(Events.InteractionCreate, async (interaction: Interaction): Promise<any> => {
        if (!interaction.isChatInputCommand()) return;

        const command = slashCommandsMap.get(interaction.commandName);
        if (!command) return;

        // Check if guild is allowed (if restrictions are set)
        if (config?.allowedGuilds && config.allowedGuilds.length > 0) {
            if (!interaction.guild?.id || !config.allowedGuilds.includes(interaction.guild.id)) {
                return interaction.reply({
                    content: "❌ This bot is not authorized for this server.",
                    ephemeral: true
                });
            }
        }

        // Cooldown handling
        if (!cooldowns.has(interaction.commandName)) {
            cooldowns.set(interaction.commandName, new Collection());
        }

        const now = Date.now();
        const timestamps = cooldowns.get(interaction.commandName)!;
        const cooldownAmount = (command.cooldown || 1) * 1000;
        const timestamp = timestamps.get(interaction.user.id);

        if (timestamp) {
            const expirationTime = timestamp + cooldownAmount;
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return interaction.reply({
                    content: i18n.__mf("common.cooldownMessage", {
                        time: timeLeft.toFixed(1),
                        name: interaction.commandName
                    }),
                    ephemeral: true
                });
            }
        }

        timestamps.set(interaction.user.id, now);
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

        try {
            const permissionsCheck: PermissionResult = await checkPermissions(command, interaction);

            if (permissionsCheck.result) {
                command.execute(interaction as ChatInputCommandInteraction);
            } else {
                throw new MissingPermissionsException(permissionsCheck.missing);
            }
        } catch (error: any) {
            console.error("[LinkedBot] Command error:", error);

            if (error.message.includes("permissions")) {
                interaction.reply({ content: error.toString(), ephemeral: true }).catch(console.error);
            } else {
                interaction.reply({ content: i18n.__("common.errorCommand"), ephemeral: true }).catch(console.error);
            }
        }
    });
}

/**
 * Initialize and start the bot
 */
async function startBot(): Promise<void> {
    if (!config) {
        sendToParent({ type: 'error', error: 'No configuration received' });
        return;
    }

    console.log(`[LinkedBot] Starting bot ${config.botId}...`);

    // Connect to MongoDB
    try {
        await mongoose.connect(config.mongodbUri);
        console.log("[LinkedBot] ✅ Connected to MongoDB");
    } catch (error: any) {
        console.error("[LinkedBot] Failed to connect to MongoDB:", error);
        sendToParent({ type: 'error', error: `MongoDB connection failed: ${error.message}` });
        return;
    }

    // Create Discord client
    client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages
        ]
    });

    // Handle ready event
    client.on('ready', async () => {
        console.log(`[LinkedBot] ✅ Bot ready: ${client!.user!.username}`);
        startTime = Date.now();

        // Initialize player
        await initializePlayer();

        // Register commands
        await registerCommands();

        // Setup interaction handler
        setupInteractionHandler();

        // Send ready status to parent
        sendToParent({
            type: 'ready',
            status: 'online',
            botId: client!.user!.id,
            botUsername: client!.user!.username,
            botAvatar: client!.user!.displayAvatarURL()
        });

        // Send periodic stats
        setInterval(() => {
            if (client) {
                sendToParent({
                    type: 'stats',
                    stats: {
                        guilds: client.guilds.cache.size,
                        songsPlayed: songsPlayed,
                        uptime: Date.now() - startTime
                    }
                });
            }
        }, 60000); // Every minute
    });

    // Handle errors
    client.on('error', (error) => {
        console.error('[LinkedBot] Client error:', error);
        sendToParent({ type: 'error', error: error.message });
    });

    client.on('warn', (info) => {
        console.warn('[LinkedBot] Warning:', info);
    });

    // Handle disconnect
    client.on('disconnect', () => {
        console.log('[LinkedBot] Disconnected');
        sendToParent({ type: 'status', status: 'offline' });
    });

    // Handle reconnect
    client.on('shardReconnecting', () => {
        console.log('[LinkedBot] Reconnecting...');
    });

    // Login
    try {
        await client.login(config.token);
    } catch (error: any) {
        console.error('[LinkedBot] Login failed:', error);
        sendToParent({ type: 'error', error: `Login failed: ${error.message}` });
        process.exit(1);
    }
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
    console.log('[LinkedBot] Shutting down...');

    // Destroy player
    if (player) {
        try {
            player.destroy();
        } catch (e) {
            // Ignore
        }
    }

    // Destroy client
    if (client) {
        try {
            client.destroy();
        } catch (e) {
            // Ignore
        }
    }

    // Close MongoDB connection
    try {
        await mongoose.disconnect();
    } catch (e) {
        // Ignore
    }

    sendToParent({ type: 'shutdown' });
    process.exit(0);
}

// Handle messages from parent process
process.on('message', async (message: any) => {
    if (message.type === 'start' && message.config) {
        config = message.config;
        await startBot();
    } else if (message.type === 'stop') {
        await shutdown();
    } else if (message.type === 'getStats') {
        if (client) {
            sendToParent({
                type: 'stats',
                stats: {
                    guilds: client.guilds.cache.size,
                    songsPlayed: songsPlayed,
                    uptime: Date.now() - startTime
                }
            });
        }
    }
});

// Handle process signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('[LinkedBot] Uncaught exception:', error);
    sendToParent({ type: 'error', error: `Uncaught exception: ${error.message}` });
});

process.on('unhandledRejection', (reason: any) => {
    console.error('[LinkedBot] Unhandled rejection:', reason);
    sendToParent({ type: 'error', error: `Unhandled rejection: ${reason?.message || reason}` });
});

console.log('[LinkedBot] Worker process started, waiting for configuration...');
