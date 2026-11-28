/**
 * One manual page per high-intent command, served at /commands/<slug>.
 *
 * Every statement here was checked against the bot's source: the command in
 * commands/, the services it calls (services/discordPlayer.ts, playFlow,
 * effects, autoplay, radio, lyrics, stay247, playerPanel, queueView) and the
 * permission rules in shared/permissions.ts. When a behaviour changes there,
 * change it here too; leave a fact out rather than guess.
 *
 * Inline formatting: text in `backticks` renders as code, and as a command
 * (amber slash) when it starts with "/".
 *
 * Server-only data: pass small derived values (like `commandPageSlugs`) to
 * client components, never this module, so the prose stays out of client JS.
 */

export type CommandOptionType = "text" | "true/false" | "whole number" | "file" | "choice";

export interface CommandDocOption {
  name: string;
  type: CommandOptionType;
  required: boolean;
  description: string;
  /** The values Discord offers, as members see them. */
  choices?: string[];
  /** Discord suggests values while you type. */
  autocomplete?: boolean;
}

export interface CommandDocSubcommand {
  name: string;
  description: string;
  options: CommandDocOption[];
}

export interface CommandDocExample {
  input: string;
  result: string;
}

export interface CommandDoc {
  /** URL segment: /commands/<slug>. */
  slug: string;
  /** The slash command as typed, e.g. "/play". Must exist in data/commands.ts and commands/. */
  command: string;
  /** <title> and h1. */
  title: string;
  /** Meta description, at most 155 characters, no backticks. */
  description: string;
  /** One line for lists of related commands. */
  summary: string;
  /** Syntax line. */
  usage: string;
  /** What it does and when to use it. At least 60 words in all. */
  intro: string[];
  options: CommandDocOption[];
  /** For commands made of subcommands (/effects): shown instead of `options`. */
  subcommands?: CommandDocSubcommand[];
  examples: CommandDocExample[];
  /** Who may use it: voice channel, permission rules, Discord permissions. */
  permissions: string[];
  /** Premium gating, or that none applies. */
  premium: string;
  limits: string[];
  /** The web dashboard's equivalent, when it has one. */
  dashboard?: string;
  /** Slugs of other command pages. */
  related: string[];
}

/** Permission notes for an action group the legacy DJ role guards (shared/permissions.ts LEGACY_DJ_GROUPS). */
function djRule(rule: string, opts: { voice?: boolean; requester?: boolean } = {}): string[] {
  const notes = [
    `Everyone can use it by default. It follows the server's "${rule}" rule: on the permissions page of the web dashboard, an admin can limit it to DJs or to admins, or allow and deny specific roles and members. Server admins always pass.`,
    "On a server that has never saved rules there, setting a DJ role with `/settings djrole` makes it DJ-only. A member who is alone with the bot in its voice channel counts as a DJ, unless an admin turns that off.",
  ];
  if (opts.requester) {
    notes.push(
      'The dashboard house rule "Requesters can skip or remove their own songs" (on by default there) lets members skip a song they added, even where Skip needs a DJ.'
    );
  }
  if (opts.voice) notes.push("You need to be in the same voice channel as Bypass.");
  return notes;
}

const ENABLED_OPTION = (what: string): CommandDocOption => ({
  name: "enabled",
  type: "true/false",
  required: false,
  description: `True turns ${what} on, False turns it off. Leave it out to switch it.`,
});

const effectToggle = (name: string, description: string): CommandDocSubcommand => ({
  name,
  description,
  options: [ENABLED_OPTION("the effect")],
});

export const commandDocs: CommandDoc[] = [
  {
    slug: "play",
    command: "/play",
    title: "/play command: play music in a Discord voice channel",
    description:
      "How the Bypass /play command works: search by name or paste a YouTube, Spotify, SoundCloud, Apple Music or Deezer link, play next, and server limits.",
    summary: "Play a song, a link or a playlist in your voice channel.",
    usage: "/play song:<name or link> [next:True] [source:YouTube|SoundCloud]",
    intro: [
      "`/play` is the main way to start music with Bypass. Join a voice channel, type `/play`, and give it a song name or a link. If nothing is playing, the song starts right away. If something is, the song goes to the end of the queue and the reply tells you its position.",
      "Names are searched on YouTube unless you pick SoundCloud as the source. While you type, Discord shows up to nine YouTube results with the channel and length of each, so you can choose the exact video instead of trusting the top hit. The first suggestion is always your own text as a plain search. With the box empty, the suggestions are the song playing now and the ones played before it in this session.",
      "Links from YouTube, YouTube Music, Spotify, SoundCloud, Apple Music and Deezer are played as pasted. `/playnext` is `/play` with next:True, and `/playnow` plays a song at once by skipping the current one.",
    ],
    options: [
      {
        name: "song",
        type: "text",
        required: true,
        autocomplete: true,
        description:
          "A song name to search for, or a link. Suggestions appear as you type; a link is played as it is.",
      },
      {
        name: "next",
        type: "true/false",
        required: false,
        description:
          "True puts the song, or every song of a playlist, right after the one playing instead of at the end of the queue. With nothing playing, it starts right away.",
      },
      {
        name: "source",
        type: "choice",
        required: false,
        choices: ["YouTube", "SoundCloud"],
        description:
          "Where a typed name is searched. YouTube when left out. Links ignore it. With SoundCloud, the suggestions only repeat your text.",
      },
    ],
    examples: [
      {
        input: "/play song:Daft Punk One More Time",
        result:
          "Searches YouTube. Pick one of the suggested videos, or choose the first suggestion to play the top result.",
      },
      {
        input: "/play song:https://www.youtube.com/playlist?list=…",
        result:
          "Queues the songs of a YouTube playlist, up to the room left in the queue. The reply shows the playlist name and how many songs were added.",
      },
      {
        input: "/play song:https://deezer.com/album/… next:True",
        result:
          "Queues the album's songs right after the current one, in album order. Apple Music and Deezer songs are matched to YouTube to play.",
      },
      {
        input: "/play song:lofi beats source:SoundCloud",
        result: "Searches SoundCloud instead of YouTube and plays the first result.",
      },
    ],
    permissions: [
      'Everyone can add songs by default. It follows the server\'s "Add songs" rule: on the permissions page of the web dashboard, an admin can limit it to DJs or to admins, or allow and deny specific roles and members. The same rule covers `/search`, `/play_file`, `/radio` and adding songs from the dashboard. A DJ role set with `/settings djrole` alone does not restrict it.',
      "You need to be in a voice channel, and Bypass needs the View Channel, Connect and Speak permissions there.",
      "If Bypass is already playing for people in another voice channel, it refuses and names that channel: join it to add songs. If it sits idle in an empty channel, it moves to yours.",
    ],
    premium:
      "Not needed. Members with Premium (the Founder tier or a support-server boost) can queue songs longer than the server's song length limit.",
    limits: [
      "Queue size: 100 songs by default; admins can set 1 to 1000 with `/settings queue`. A full queue refuses new songs, and a playlist only fills the space that is left.",
      "Song length: no limit by default. When an admin sets one on the dashboard, longer songs are refused and playlists leave them out.",
      "Duplicates: with Block duplicates on (`/settings queue`), a single song that is already playing or waiting is refused. Playlists are not checked.",
      "Voice channels: admins can keep Bypass to some voice channels with `/settings voicechannels`.",
      "It does not work while a guess-the-song game is running in the server.",
      "Cooldown: 2 seconds per member.",
    ],
    dashboard:
      "The web dashboard has an Add song panel: search or paste a link, pick which Bypass bot plays it and, for an idle bot, the voice channel it should join.",
    related: ["search", "play-file", "queue", "radio", "nowplaying", "skip"],
  },

  {
    slug: "search",
    command: "/search",
    title: "/search command: pick songs from YouTube results",
    description:
      "Search YouTube from Discord with the Bypass /search command and pick one or more results from a menu. How it differs from /play and who can use it.",
    summary: "Search YouTube and pick one or more results to queue.",
    usage: "/search query:<text>",
    intro: [
      "`/search` looks a song up on YouTube and shows you up to ten results before anything plays. Each result lists its title, channel and length, and a menu under the list lets you pick the ones you want. The list is only visible to you, so it doesn't fill the channel.",
      "Pick one result to play it, or select several and they are queued in the order you picked them. Use it when the top hit isn't the version you want, or to take a few songs from one search. For a single song, the suggestions in `/play` do the same job in one step.",
    ],
    options: [
      { name: "query", type: "text", required: true, description: "What to search for on YouTube." },
    ],
    examples: [
      {
        input: "/search query:bohemian rhapsody",
        result: "Shows up to 10 YouTube results, privately, with a menu to pick from.",
      },
      {
        input: "/search query:lofi hip hop",
        result:
          "Select three results in the menu and all three are queued, in the order you picked them. The menu is replaced by the titles you chose.",
      },
    ],
    permissions: [
      'Each pick goes through the same checks as `/play`: you need to be in a voice channel Bypass can join, and the server\'s "Add songs" rule applies (everyone by default).',
      "Only the member who searched can use the menu.",
    ],
    premium: "Not needed.",
    limits: [
      "YouTube only.",
      "Results are kept for about 10 minutes and are cleared when the bot restarts. If the menu has expired, search again.",
      "The server's queue size, song length and duplicate rules apply to each pick, as with `/play`.",
      "Cooldown: 3 seconds per member.",
    ],
    dashboard:
      "The Add song panel on the web dashboard searches too: type a name and add any result to a bot's queue.",
    related: ["play", "queue", "play-file"],
  },

  {
    slug: "radio",
    command: "/radio",
    title: "/radio command: endless music from a song, genre or AI DJ",
    description:
      "Start endless music in Discord with /radio: from a song or artist, one of 18 genre stations, or an AI DJ prompt. How songs are picked and the AI limits.",
    summary: "Endless music from a song, a genre station or an AI DJ prompt.",
    usage: "/radio [song:<song or artist>] [station:<genre>] [prompt:<description>]",
    intro: [
      "`/radio` starts music that keeps going after the queue runs out. Give it a song or an artist, pick one of 18 genre stations, or describe what you want in words and let the AI DJ choose the songs. Run it with no options to turn the song playing now into a radio.",
      "A radio turns autoplay on. Related songs come from the YouTube mix of what is playing, and every third pick is taken from the songs the radio started from rather than the current one. That keeps a lo-fi station on lo-fi an hour later instead of drifting into pop. To end the radio and keep the songs already queued, run `/autoplay enabled:False`.",
    ],
    options: [
      {
        name: "song",
        type: "text",
        required: false,
        autocomplete: true,
        description: "A song or artist to start from. It shows the same suggestions as `/play`.",
      },
      {
        name: "station",
        type: "choice",
        required: false,
        choices: [
          "Pop",
          "Rock",
          "Hip-hop",
          "Latin / Reggaeton",
          "Rock en español",
          "Electronic",
          "Lo-fi",
          "Chill",
          "R&B",
          "Indie",
          "Metal",
          "Jazz",
          "Classical",
          "80s hits",
          "2000s hits",
          "K-pop",
          "Anime",
          "Reggae",
        ],
        description: "A genre station. It starts from well-known songs of that style.",
      },
      {
        name: "prompt",
        type: "text",
        required: false,
        description:
          "AI DJ: describe the music, such as a mood, genre, era or artists. Up to 300 characters.",
      },
    ],
    examples: [
      {
        input: "/radio",
        result:
          "Turns the song playing now into a radio. You need to be in the bot's voice channel.",
      },
      {
        input: "/radio song:Arctic Monkeys",
        result: "Plays the top YouTube result for it, then keeps going with related songs.",
      },
      {
        input: "/radio station:Lo-fi",
        result:
          "Starts with one of four well-known lo-fi songs, chosen at random. The other three keep later picks on genre.",
      },
      {
        input: "/radio prompt:rainy night jazz",
        result:
          "The AI DJ picks 10 songs for the description and queues them, then picks more when they run out, avoiding songs that already played.",
      },
    ],
    permissions: [
      'It follows the server\'s "Add songs" rule (everyone by default) and has the same voice channel checks as `/play`.',
      "Use only one of song, station or prompt; giving two is refused.",
      "Starting a radio from the current song requires being in the bot's voice channel.",
    ],
    premium:
      "Song and station radios are free. The AI DJ has a few free requests per server each day; the reply shows how many are left, and the count resets at 00:00 UTC. Premium (the Founder tier, a support-server boost, or a server linked with `/premium link`) raises the daily limit and lets an AI radio run for more batches.",
    limits: [
      "When an AI radio has used its batches, it carries on with related songs from YouTube, like a song radio.",
      "Autoplay only adds songs between 1 and 12 minutes long when it knows the length.",
      "It does not work while a guess-the-song game is running in the server.",
      "Cooldown: 5 seconds per member.",
    ],
    related: ["autoplay", "play", "queue", "skip"],
  },

  {
    slug: "lyrics",
    command: "/lyrics",
    title: "/lyrics command: song lyrics in Discord, synced live",
    description:
      "Use /lyrics to show the lyrics of the song Bypass is playing, or of any song by name. Synced songs get a live view that follows along line by line.",
    summary: "Lyrics for the song playing now, or any song by name.",
    usage: "/lyrics [query:<song>] [private:True]",
    intro: [
      "`/lyrics` shows the lyrics of the song Bypass is playing in your server. Give it a song name instead and it looks that song up, whether or not anything is playing. The footer names the service the lyrics came from.",
      "When the playing song has synced lyrics, the reply has a Live lyrics button. It opens a view that follows the song as it plays: the line being sung, the one before it and the next two. It shows when the song is paused, and it ends when the song changes or stops.",
    ],
    options: [
      {
        name: "query",
        type: "text",
        required: false,
        description: "The song to look up, up to 200 characters. Leave it out for the song playing now.",
      },
      {
        name: "private",
        type: "true/false",
        required: false,
        description: "True shows the lyrics only to you.",
      },
    ],
    examples: [
      {
        input: "/lyrics",
        result:
          "Posts the lyrics of the song playing now. If synced lyrics exist, a Live lyrics button appears under them.",
      },
      {
        input: "/lyrics query:Bohemian Rhapsody Queen",
        result: "Looks that song up by name. It works with nothing playing.",
      },
      {
        input: "/lyrics private:True",
        result: "Same as /lyrics, but only you see the reply.",
      },
    ],
    permissions: [
      'In a server it follows the "Lyrics" rule, which lets everyone use it by default; an admin can limit it on the permissions page of the web dashboard.',
      "If you add Bypass to your Discord account, `/lyrics` also works in DMs and in servers without the bot. There you give it a song name.",
      "Only the member who opened a live view, or someone with the Manage Messages permission, can press its Stop button.",
    ],
    premium: "Not needed.",
    limits: [
      "One live view per server: opening a new one ends the previous one. A live view also stops after two hours.",
      "When the synced lyrics were timed for a version of the song with a different length, the live view notes that lines may drift.",
      "Very long lyrics are cut to fit one Discord message.",
      "The lyrics of the playing song are hidden while a guess-the-song game is running.",
      "Cooldown: 4 seconds per member.",
    ],
    dashboard:
      "The web dashboard has no lyrics view. In Discord, the Lyrics button on the player (`/nowplaying`) does the same as `/lyrics` for the playing song.",
    related: ["nowplaying", "play", "queue"],
  },

  {
    slug: "effects",
    command: "/effects",
    title: "/effects command: bass boost, nightcore, 8D and more",
    description:
      "Every Bypass /effects option: bass boost levels, nightcore, vaporwave, 8D, karaoke, lo-fi and more, plus how to stack, list and clear them.",
    summary: "Audio effects on the music: bass boost, nightcore, 8D and others.",
    usage: "/effects <effect> [enabled:True|False]",
    intro: [
      "`/effects` changes how the music sounds for everyone in the voice channel. There are 13 effects, from bass boost and nightcore to 8D audio and karaoke. Each one is a subcommand: `/effects nightcore` turns nightcore on, and running it again turns it off.",
      "Effects stack, so bass boost and 8D can run together. Two rules keep combinations sensible: nightcore and vaporwave change speed in opposite directions, so turning one on turns the other off, and only one bass boost level is active at a time. `/effects list` shows what is on and `/effects clear` removes everything. Turning an effect on or off is announced in the channel with the name of the member who did it.",
    ],
    options: [],
    subcommands: [
      {
        name: "bassboost",
        description: "Bass boost. Without a level it sets Medium; Off removes it.",
        options: [
          {
            name: "level",
            type: "choice",
            required: false,
            choices: ["Off", "Low", "Medium", "High"],
            description: "The bass level.",
          },
        ],
      },
      effectToggle("nightcore", "Faster and higher-pitched. Turns vaporwave off."),
      effectToggle("vaporwave", "Slower and lower-pitched. Turns nightcore off."),
      effectToggle("8d", "Rotates the sound around you."),
      effectToggle("karaoke", "Reduces the vocals."),
      effectToggle("lofi", "Slightly slower, lower and wider."),
      effectToggle("tremolo", "Wavering volume."),
      effectToggle("vibrato", "Wavering pitch."),
      effectToggle("pulsator", "Pulses the sound between the left and right ear."),
      effectToggle("haas", "A wider stereo image."),
      effectToggle("surrounding", "Surround sound."),
      effectToggle("reverse", "Plays the audio backwards."),
      effectToggle("distortion", "Heavy, loud distortion."),
      { name: "list", description: "Shows the filters that are on.", options: [] },
      { name: "clear", description: "Turns every effect off.", options: [] },
    ],
    examples: [
      {
        input: "/effects bassboost level:High",
        result: "Sets bass boost to High, replacing any other level.",
      },
      {
        input: "/effects nightcore",
        result: "Turns nightcore on, or off if it was on. Vaporwave goes off if it was on.",
      },
      {
        input: "/effects 8d enabled:True",
        result: "Makes sure 8D is on, whatever its state was.",
      },
      { input: "/effects clear", result: "Removes every effect." },
    ],
    permissions: [...djRule("Effects", { voice: true }), "Something has to be playing."],
    premium: "Not needed. Every effect is free.",
    limits: [
      "`/effects list` shows the filters by their internal names: distortion appears as earrape, and the bass levels as bassboost_low, bassboost and bassboost_high.",
    ],
    dashboard:
      "The player on the web dashboard has switches for eight of them: bass boost, nightcore, vaporwave, 8D, karaoke, tremolo, vibrato and lo-fi. Its bass boost switch uses the Medium level.",
    related: ["volume", "nowplaying", "play", "loop"],
  },

  {
    slug: "247",
    command: "/247",
    title: "/247 command: keep the music bot in voice 24/7",
    description:
      "How Bypass 24/7 mode works: /247 keeps the bot in your voice channel around the clock and after restarts. Who can turn it on and what Premium it needs.",
    summary: "Keep Bypass in its voice channel around the clock, also after restarts.",
    usage: "/247 [enabled:True|False]",
    intro: [
      "By default Bypass leaves a voice channel when the queue ends or everyone else leaves, after the server's idle timeout (5 minutes unless an admin changes it). `/247` turns that off: the bot stays in its channel when the music stops and when the channel empties, and it rejoins the same channel after a restart.",
      "Turning 24/7 on needs Premium for the member who runs it: the Founder tier, a support-server boost, or a vote on a bot list, which unlocks it for 12 hours. 24/7 keeps running on that member's access. Bypass checks it every 15 minutes, and when it has run out, 24/7 switches off and the bot posts a note in the channel where it was turned on.",
    ],
    options: [ENABLED_OPTION("24/7")],
    examples: [
      {
        input: "/247",
        result:
          "From the voice channel Bypass should keep: turns 24/7 on if it was off, and Bypass stays there. If you aren't in a voice channel, it keeps the one it is already in.",
      },
      {
        input: "/247 enabled:False",
        result:
          "Turns 24/7 off. Bypass leaves after the idle timeout, or right away if nothing is playing or queued.",
      },
    ],
    permissions: [
      "It needs the Manage Server permission by default (set on the command in Discord, where admins can change who may use it under Server Settings, Integrations).",
      "Bypass won't take 24/7 to your channel while it is playing for people in another one.",
      "Turning 24/7 off never needs Premium.",
    ],
    premium:
      "Needed to turn it on: the Founder tier, a support-server boost, or an active vote (12 hours per vote, see `/vote`).",
    limits: [
      "One 24/7 channel per bot.",
      "If the member who turned it on loses Founder, stops boosting or their vote expires, 24/7 turns off at the next check (every 15 minutes) or at the next restart.",
      "While 24/7 is on, the Stop button on the player clears the music but the bot stays in the channel.",
    ],
    dashboard:
      "The Voice section of the dashboard settings shows whether 24/7 is on and in which channel. Turning it on or off is done with `/247` in Discord.",
    related: ["autoplay", "radio", "nowplaying"],
  },

  {
    slug: "volume",
    command: "/volume",
    title: "/volume command: change the music bot's volume",
    description:
      "Set or check the Bypass playback volume with /volume, from 0 up to the server's maximum. Who can change it, the default level and the player buttons.",
    summary: "Check or set the playback volume.",
    usage: "/volume [volume:<0-100>]",
    intro: [
      "`/volume` sets how loud Bypass plays for everyone in the voice channel. Give it a number from 0 to the server's maximum, which is 100 unless an admin lowers it, and the change applies right away. Run it without a number to see the current level.",
      "The volume belongs to the current session. A new session starts at the server's default volume, which is 80 unless an admin sets another with `/settings volume`. The volume buttons on the player (`/nowplaying`) move it in steps of 10.",
    ],
    options: [
      {
        name: "volume",
        type: "whole number",
        required: false,
        description: "The new volume, from 0 to the server's maximum. Leave it out to see the current volume.",
      },
    ],
    examples: [
      { input: "/volume", result: "Replies with the current volume." },
      { input: "/volume volume:50", result: "Sets the volume to 50% for everyone listening." },
      {
        input: "/volume volume:90",
        result: "On a server whose maximum is 70: refused, with the allowed range in the reply.",
      },
    ],
    permissions: [...djRule("Volume", { voice: true }), "Bypass must have a session running."],
    premium: "Not needed.",
    limits: [
      "Maximum: 100 by default. Admins can lower it with `/settings volume max:`, which also caps the player buttons and the dashboard slider.",
      "Default for new sessions: 80, set with `/settings volume default:`.",
    ],
    dashboard: "The player on the web dashboard has a volume slider, limited to the server's maximum.",
    related: ["effects", "nowplaying", "play"],
  },

  {
    slug: "queue",
    command: "/queue",
    title: "/queue command: see what plays next",
    description:
      "Show the Bypass music queue with /queue: the song playing now, what comes next, who added each song, total length, and the loop and autoplay state.",
    summary: "See the song playing now and the songs waiting, 10 per page.",
    usage: "/queue [page:<number>]",
    intro: [
      "`/queue` posts the queue in the channel: the song playing now with how far into it the music is, then the songs waiting, ten per page. Each line has the song's length and the member who added it, and songs added by autoplay are marked with ♾️.",
      "The footer shows how many songs are queued, their total length, and whether loop or autoplay is on. The page and Refresh buttons keep working on the message, so you can come back to it and update it instead of running the command again. The numbers in the list are the positions that `/jump`, `/remove` and `/move` take.",
    ],
    options: [
      {
        name: "page",
        type: "whole number",
        required: false,
        description: "Which page to open first, from 1. Each page holds 10 songs.",
      },
    ],
    examples: [
      { input: "/queue", result: "Shows the first page of the queue." },
      {
        input: "/queue page:3",
        result: "Opens page 3, songs 21 to 30. A page past the end shows the last page.",
      },
    ],
    permissions: [
      "Anyone can use it, from any channel the bot answers in. It only reads the queue.",
    ],
    premium: "Not needed.",
    limits: ["Something has to be playing or queued.", "Cooldown: 3 seconds per member."],
    dashboard:
      "The player page on the web dashboard shows each bot's queue with the time each song should start. You can drag songs to reorder them, remove them, or jump to one.",
    related: ["nowplaying", "shuffle", "skip", "loop", "play"],
  },

  {
    slug: "loop",
    command: "/loop",
    title: "/loop command: repeat a song or the whole queue",
    description:
      "Repeat the current song or the whole queue with the Bypass /loop command, or turn repeat off. How the modes work with autoplay and the player buttons.",
    summary: "Repeat this song, repeat the whole queue, or turn repeat off.",
    usage: "/loop [mode:Off|This song|Whole queue]",
    intro: [
      "`/loop` controls repeat. This song plays the current song again each time it ends. Whole queue starts the list over once the last song has played. Off goes back to normal playback, where each song plays once.",
      "Run it without a mode to step through the modes in order: off, this song, whole queue, then off again. The loop button on the player (`/nowplaying`) steps through them in the same order. While a loop mode is on, autoplay doesn't add related songs, and both the player and the footer of `/queue` show which mode is active.",
    ],
    options: [
      {
        name: "mode",
        type: "choice",
        required: false,
        choices: ["Off", "This song", "Whole queue"],
        description: "The repeat mode. Leave it out to move to the next mode.",
      },
    ],
    examples: [
      { input: "/loop mode:This song", result: "The current song repeats until the mode changes." },
      { input: "/loop", result: "Moves to the next mode, for example from off to this song." },
      { input: "/loop mode:Off", result: "Back to normal: each song plays once." },
    ],
    permissions: [...djRule("Loop and autoplay", { voice: true }), "Something has to be playing."],
    premium: "Not needed.",
    limits: ["Autoplay pauses its picks while a loop mode is on."],
    dashboard:
      "The player on the web dashboard has a loop button that steps through off, whole queue and this song.",
    related: ["queue", "autoplay", "nowplaying", "skip"],
  },

  {
    slug: "shuffle",
    command: "/shuffle",
    title: "/shuffle command: shuffle the music queue",
    description:
      "Put the songs waiting in the Bypass queue in random order with /shuffle. What it changes, who can use it, and how to shuffle from the player.",
    summary: "Put the waiting songs in a random order.",
    usage: "/shuffle",
    intro: [
      "`/shuffle` puts the songs waiting in the queue in a random order. The song playing now keeps playing; only what comes after it moves. Use it after queueing a long playlist so it doesn't play in track order.",
      "Shuffling is a one-time reorder, not a mode: songs added later go to the end as usual, and you can run it again whenever you like. The reply names who shuffled, so everyone in the channel knows why the order changed. The shuffle button on the player (`/nowplaying`) does the same.",
    ],
    options: [],
    examples: [
      {
        input: "/shuffle",
        result: "Every song after the one playing gets a new random position. The current song is not interrupted.",
      },
      {
        input: "/shuffle",
        result:
          "Right after queueing a playlist with /play: the playlist plays in random order once the current song ends.",
      },
    ],
    permissions: [...djRule("Reorder and remove", { voice: true }), "Bypass must have a session running."],
    premium: "Not needed.",
    limits: ["The shuffle button on the player needs at least two songs in the queue."],
    dashboard: "The player and the queue list on the web dashboard both have a shuffle button.",
    related: ["queue", "loop", "play", "skip"],
  },

  {
    slug: "skip",
    command: "/skip",
    title: "/skip command: skip the current song",
    description:
      "Skip the song Bypass is playing with /skip. Who may skip, how requesters can skip their own songs, and when to use /voteskip instead.",
    summary: "Skip the song playing now.",
    usage: "/skip",
    intro: [
      "`/skip` ends the song playing now and starts the next one in the queue. It has no options. To go several songs ahead at once, use `/jump` with a position from `/queue`.",
      "Skipping follows the server's Skip rule, which lets everyone skip by default. When an admin limits skipping to DJs, members can usually still skip songs they added themselves, and everyone else can start a vote with `/voteskip`. The skip button on the player (`/nowplaying`) follows the same rules. The reply names who skipped.",
    ],
    options: [],
    examples: [
      { input: "/skip", result: "The next song in the queue starts, and the reply names who skipped." },
      {
        input: "/skip",
        result: "On the last song with autoplay off: playback ends. With autoplay on, the related song it lined up plays.",
      },
    ],
    permissions: [...djRule("Skip", { voice: true, requester: true }), "Bypass must have a session running."],
    premium: "Not needed.",
    limits: ["Members who may not skip can use `/voteskip`, unless an admin turned vote-skip off."],
    dashboard:
      "The player on the web dashboard has a skip button, and the queue list can jump straight to any song.",
    related: ["voteskip", "queue", "nowplaying", "loop"],
  },

  {
    slug: "voteskip",
    command: "/voteskip",
    title: "/voteskip command: let the channel vote to skip",
    description:
      "How /voteskip works in Bypass: listeners vote, and the song skips once enough agree, half by default. Who can vote and how admins change the share.",
    summary: "Start or join a vote to skip the song playing now.",
    usage: "/voteskip",
    intro: [
      "`/voteskip` lets the people listening decide together whether to skip a song. Each member in Bypass's voice channel can vote once per song, and the song is skipped as soon as enough votes are in. Each vote is posted in the channel with the running count, such as 2/3.",
      "The number of votes needed is a share of the listeners, rounded up: half by default, so with 5 people in the channel, 3 votes skip the song. Bots don't count as listeners. This is how a server can keep `/skip` for DJs and still let everyone else get past a song nobody wants.",
    ],
    options: [],
    examples: [
      {
        input: "/voteskip",
        result: "With 3 people listening, 2 votes are needed. The first vote shows 1/2; the second skips the song.",
      },
      { input: "/voteskip", result: "Alone with the bot, one vote is enough and the song skips at once." },
      { input: "/voteskip", result: "A second vote from the same member on the same song is refused." },
    ],
    permissions: [
      "Anyone in the bot's voice channel can vote, including members who may not use `/skip`.",
      'Members on the deny list of the "Skip" rule, by name or by role, cannot vote.',
      "Admins can turn vote-skip off, or change the share of listeners needed, under House rules on the permissions page of the web dashboard.",
    ],
    premium: "Not needed.",
    limits: ["Something has to be playing, and you have to be in the bot's voice channel."],
    dashboard:
      "Votes happen in Discord. The dashboard's permissions page sets whether vote-skip is on and the share of listeners it needs (10% to 100%).",
    related: ["skip", "queue", "nowplaying"],
  },

  {
    slug: "nowplaying",
    command: "/nowplaying",
    title: "/nowplaying command: the live player with buttons",
    description:
      "Use /nowplaying to bring the Bypass player to the bottom of the chat: song, progress, volume and loop state, with buttons for pause, skip, loop and more.",
    summary: "Bring the live player and its buttons to the bottom of the chat.",
    usage: "/nowplaying",
    intro: [
      "`/nowplaying` posts the player for the song playing now: title, artist, length, who requested it, a progress bar, the volume, the loop and autoplay state, and the next song in the queue. Bypass keeps one player message per server, so this moves it to the bottom of the chat and deletes the old copy, which helps once the chat has scrolled past it.",
      "The player is posted again for each new song, unless it is still the last message in the channel, and it is edited when someone pauses or changes the volume or the queue. Its buttons let people in the voice channel control the music without typing: previous, play or pause, skip, stop, loop, shuffle, volume down and up, and autoplay. Three more work from anywhere in the server: Queue shows the queue only to you, Lyrics fetches the lyrics, and Save sends the song to your DMs.",
    ],
    options: [],
    examples: [
      { input: "/nowplaying", result: "Posts the player at the bottom of the chat and removes the previous one." },
      {
        input: "/nowplaying",
        result: "During a guess-the-song game: refused, since the player would give the answer away. It comes back when the game ends.",
      },
    ],
    permissions: [
      "Anyone can post the player.",
      "The control buttons only work for members in the bot's voice channel, and each one follows the server's rule for that action (Skip, Volume, Loop and autoplay, and so on). The Lyrics button follows the Lyrics rule.",
    ],
    premium: "Not needed.",
    limits: [
      "The volume buttons move in steps of 10, up to the server's maximum.",
      "Stop also turns autoplay off and ends a radio. With 24/7 on, it clears the music but the bot stays in the channel.",
      "With now-playing announcements turned off (`/settings behavior`), the player isn't posted for each new song, but `/nowplaying` still posts it.",
      "Cooldown: 5 seconds per member.",
    ],
    dashboard:
      "The player page on the web dashboard shows the same information live for each Bypass bot in the server, with transport, seek, volume, loop, autoplay and effects controls.",
    related: ["queue", "lyrics", "skip", "volume", "loop"],
  },

  {
    slug: "autoplay",
    command: "/autoplay",
    title: "/autoplay command: keep music playing after the queue",
    description:
      "Turn on Bypass autoplay with /autoplay so related songs keep playing when the queue runs out. How songs are picked and how to make it the server default.",
    summary: "Keep playing related songs when the queue runs out.",
    usage: "/autoplay [enabled:True|False] [default:True]",
    intro: [
      "With autoplay on, Bypass doesn't stop when the queue runs out. As soon as the last queued song starts, it lines up a related song from the YouTube mix of what is playing, so there is no gap. Songs picked this way show ♾️ in `/queue` and \"picked by autoplay\" on the player.",
      "It skips songs that already played or are waiting in the session, and leaves out songs shorter than a minute or longer than 12 minutes, so a two-hour compilation doesn't end up in the mix. `/autoplay` changes the current session; add default:True to make autoplay the starting state of every new session in the server.",
    ],
    options: [
      ENABLED_OPTION("autoplay"),
      {
        name: "default",
        type: "true/false",
        required: false,
        description: "True also saves the choice as the server default for new sessions. Needs Manage Server.",
      },
    ],
    examples: [
      { input: "/autoplay", result: "Switches autoplay on or off for the current session." },
      {
        input: "/autoplay enabled:True default:True",
        result: "Turns autoplay on now and for every new session in the server.",
      },
      {
        input: "/autoplay enabled:False",
        result: "Turns it off and removes the autoplay songs waiting in the queue. A `/radio` session ends too.",
      },
    ],
    permissions: [
      ...djRule("Loop and autoplay"),
      "The default option needs the Manage Server permission.",
    ],
    premium: "Not needed.",
    limits: [
      "No related songs are added while a loop mode is on.",
      "Without default:True, the change only lasts for the current session.",
      "Songs from SoundCloud, Spotify and other sources are matched to YouTube to find the mix.",
    ],
    dashboard:
      "The player on the web dashboard has an autoplay switch for each bot, and the dashboard settings have an Autoplay switch for the server default.",
    related: ["radio", "loop", "queue", "247"],
  },

  {
    slug: "seek",
    command: "/seek",
    title: "/seek command: jump to a time in the song",
    description:
      "Jump to any point of the song Bypass is playing with /seek. Accepted time formats (1:30, 90, 1m30s), the limits, and the dashboard seek bar.",
    summary: "Jump to a time in the song playing now.",
    usage: "/seek time:<time>",
    intro: [
      "`/seek` jumps to a point in the song playing now, forwards or backwards. Write the time the way you would say it: 1:30, 90 and 1m30s all mean one minute and thirty seconds into the song. The reply confirms the new position and who moved it.",
      "For songs longer than an hour, write the minutes in full, such as 75:00 for one hour and fifteen minutes; the hours:minutes:seconds form isn't understood. To step back a little instead, `/rewind` moves back 10 seconds by default, and `/replay` starts the song over.",
    ],
    options: [
      {
        name: "time",
        type: "text",
        required: true,
        description:
          "Where to jump: minutes:seconds (1:30), seconds (90 or 90s), minutes and seconds (1m30s), or minutes (2m).",
      },
    ],
    examples: [
      { input: "/seek time:1:30", result: "Jumps to 1:30." },
      { input: "/seek time:45", result: "Jumps to 0:45." },
      { input: "/seek time:2m", result: "Jumps to 2:00." },
      {
        input: "/seek time:10:00",
        result: "On a 4-minute song: refused, and the reply gives the song's length.",
      },
    ],
    permissions: [...djRule("Pause, resume, seek, previous", { voice: true }), "Something has to be playing."],
    premium: "Not needed.",
    limits: ["The time has to be before the end of the song.", "Live streams have no length, so they can't be seeked."],
    dashboard:
      "The player on the web dashboard has a seek bar, and its left and right arrow keys jump 10 seconds.",
    related: ["nowplaying", "loop", "queue"],
  },

  {
    slug: "play-file",
    command: "/play_file",
    title: "/play_file command: play an audio file in voice",
    description:
      "Play an MP3, FLAC, WAV or other audio file in a Discord voice channel with /play_file. Supported formats, the 25 MB limit and the optional title.",
    summary: "Play an audio file you upload.",
    usage: "/play_file file:<audio file> [title:<text>]",
    intro: [
      "`/play_file` plays an audio file you attach to the command, such as a recording, a song you made, or a track that isn't on any streaming site. Attach the file in the command's file box and send it: Bypass plays it in your voice channel, or adds it to the queue if something is already playing.",
      "Common formats work, including MP3, M4A, AAC, WAV, FLAC, OGG and Opus, along with less common ones like AIFF, WMA and WebM. The reply shows the file's format, size and length, and its position when it was queued. Files can be up to 25 MB.",
    ],
    options: [
      {
        name: "file",
        type: "file",
        required: true,
        description:
          "The audio file. Accepted extensions: .mp3, .m4a, .aac, .wav, .flac, .ogg, .opus, .wma, .aiff, .ape, .ac3, .dts, .alac, .oga, .webm, .3gp, .amr, .tta, .mka, .wv and .m4b.",
      },
      {
        name: "title",
        type: "text",
        required: false,
        description: "A name to show in the reply instead of the file name.",
      },
    ],
    examples: [
      {
        input: "/play_file file:demo.mp3",
        result: "Plays demo.mp3 in your voice channel, or queues it, and shows its format, size and length.",
      },
      {
        input: "/play_file file:mix.flac title:Friday mix",
        result: "The same, with Friday mix shown in the reply instead of the file name.",
      },
      { input: "/play_file file:notes.pdf", result: "Refused: only audio file types are accepted." },
    ],
    permissions: [
      'It follows the server\'s "Add songs" rule (everyone by default).',
      "You need to be in a voice channel the server allows, and Bypass needs the Connect and Speak permissions.",
      "If Bypass is playing for people in another voice channel, it refuses and names that channel.",
    ],
    premium: "Not needed.",
    limits: [
      "25 MB per file.",
      "The server's queue size limit applies.",
      "Cooldown: 3 seconds per member.",
    ],
    related: ["play", "queue", "search"],
  },
];

/** Command → page slug, small enough to hand to client components. */
export const commandPageSlugs: Record<string, string> = Object.fromEntries(
  commandDocs.map((doc) => [doc.command, doc.slug])
);

export function getCommandDoc(slug: string): CommandDoc | undefined {
  return commandDocs.find((doc) => doc.slug === slug);
}
