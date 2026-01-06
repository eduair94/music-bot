# Music Bot Commands Checklist

This document tracks all expected commands from the Jockie Music API compared against our implementation.

**Legend:**
- [x] = Implemented
- [ ] = Not implemented
- ⭐ = Premium feature

---

## Meta Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `clean` | Clean bot messages | NEW - Implemented |
| [x] | `premium` | Premium information | Implemented |
| [x] | `leaderboard` | View the leaderboard | Implemented |
| [x] | `vote` | Vote for the bot | Implemented |
| [x] | `faq` | Frequently asked questions | Implemented |
| [x] | `invite` | Get bot invite link | Implemented |
| [x] | `setup` | Setup the bot | Implemented |
| [x] | `support` | Get support server link | NEW - Implemented |
| [x] | `tip` | Tip information | Implemented |
| [x] | `help` | Get help with commands | Implemented |
| [x] | `categories` | List command categories | Implemented |
| [x] | `changelogs` | View changelogs | Implemented |
| [x] | `about` | About the bot | NEW - Implemented |
| [x] | `dashboard` | Dashboard link | NEW - Implemented |
| [x] | `ping` | Check bot latency | Implemented |
| [x] | `shards` | View shard information | Implemented |
| [x] | `stats` | Bot statistics | Implemented |

---

## Playback Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `autoplay` | Toggle autoplay mode | Implemented |
| [x] | `play` | Play a track | Implemented |
| [x] | `playrecent` | Play recently played tracks | Implemented |
| [x] | `radio` | Start radio based on current track | Implemented |
| [x] | `resume session` | Resume a previous session | |
| [x] | `join` | Join voice channel | Implemented |
| [x] | `leave` | Leave voice channel | Implemented |
| [x] | `album search` | Search and queue an album | Implemented (albumsearch.ts) |
| [x] | `playlist search` | Search and queue a playlist | Implemented (playlistsearch.ts) |
| [x] | `search` | Search for a track | Implemented |
| [x] | `insert` | Insert track after current | Implemented |
| [x] | `playleave` | Queue track and leave after | Implemented |
| [x] | `playselect` | Select and queue from playlist | Implemented (playselect.ts) |
| [x] | `playsingle` | Queue single track from playlist | Implemented (playsingle.ts) |
| [x] | `playnow` | Play track immediately | Implemented |
| [x] | `playnext` | Add track as next in queue | Implemented |

---

## Track State Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `backward` | Wind track backwards | Implemented |
| [x] | `endtime` | Set end position of track | Implemented |
| [x] | `forward` | Wind track forwards | Implemented |
| [x] | `pause` | Pause current track | Implemented |
| [x] | `resume` | Resume playback | Implemented |
| [x] | `starttime` | Set start position of track | Implemented |
| [x] | `volume` | Change volume | Implemented |
| [x] | `seek` | Wind to position in track | Implemented |
| [x] | `wind` | Wind to desired position | NEW - Implemented (wind.ts) |

---

## Queue State Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `reverse` | Reverse the queue | Implemented |
| [x] | `shuffle` | Shuffle the queue | Implemented |
| [x] | `sort` | Sort the queue | Implemented |
| [x] | `massmove` | Move multiple tracks | Implemented |
| [x] | `move` | Move a track | Implemented |
| [x] | `swap` | Swap two tracks | Implemented |
| [x] | `reorder` | Order queue by option | Implemented (reorder.ts) |

### Index Subcommands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `next` | Go to next track | Implemented |
| [x] | `previous` | Go to previous track | Implemented |
| [x] | `skip` | Skip current track | Implemented |
| [x] | `skipto` | Skip to specific track | Implemented (also `jump`) |
| [x] | `voteskip` | Vote to skip | Implemented |

### Repeat Subcommands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `restart` | Restart the queue | Implemented |
| [x] | `repeat` | Unified repeat command | NEW - Implemented (repeat.ts with current/queue/disable/status) |
| [x] | `loop` | Repeat current track | Implemented (repeat current) |
| [x] | `repeat disable` | Disable repeating | Implemented (repeatdisable.ts) |
| [x] | `loopqueue` | Repeat the queue | Implemented (repeat queue) |
| [x] | `rewind` | Rewind current track | Implemented |

### Options Subcommands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `select random` | Select tracks randomly | Implemented (selectrandom.ts) |
| [x] | `remove after played` | Remove tracks after played | Implemented (removeafterplayed.ts) |
| [x] | `shuffle repeat` | Shuffle on repeat | Implemented (shufflerepeat.ts) |

### Remove Subcommands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `clear` | Remove all tracks | Implemented |
| [x] | `mass remove` | Remove multiple tracks | NEW - Implemented (massremove) |
| [x] | `remove` | Remove a track | Implemented |
| [x] | `remove absent` | Remove absent users' tracks | Implemented (removeabsent) |
| [x] | `removecurrent` | Remove current track | Implemented |
| [x] | `removeduplicates` | Remove duplicate tracks | Implemented (removedupes) |
| [x] | `remove keyword` | Remove by keyword | Implemented (removekeyword) |
| [x] | `removelast` | Remove last track | Implemented |
| [x] | `removerange` | Remove range of tracks | Implemented |
| [x] | `remove user` | Remove user's tracks | NEW - Implemented (removeuser) |

---

## Information Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `nextup` | Info about next track | Implemented |
| [x] | `nowplaying` | Current track info | Implemented |
| [x] | `queue` | List full queue | Implemented |
| [x] | `queueinfo` | Queue information | Implemented |
| [x] | `history` | Recently played tracks | Implemented |
| [x] | `recentlyplayed` | View recently played tracks | NEW - Implemented (recentlyplayed.ts) |
| [x] | `requested` | Tracks by user | NEW - Implemented |
| [x] | `save` | Save song to DMs | Implemented |
| [x] | `grab` | DM yourself the current track | Implemented |
| [x] | `length` | Show queue duration | Implemented |
| [x] | `session information` | Session info | Implemented (sessioninfo.ts) |
| [x] | `session statistics` | Session stats | Implemented (sessionstats.ts) |
| [x] | `upcoming` | List upcoming tracks | NEW - Implemented |

### Genius Subcommands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `album info` | Album information | Implemented (albuminfo.ts) |
| [x] | `artist info` | Artist information | Implemented (artistinfo.ts) |
| [x] | `lyrics` | Get song lyrics | Implemented |
| [x] | `searchlyrics` | Search by lyrics | NEW - Implemented |
| [x] | `song info` | Song information | Implemented (songinfo.ts) |
| [x] | `top songs` | Get top songs | Implemented (topsongs.ts) |

---

## Profile Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `profile` | View profile | Implemented |
| [x] | `profile set server visibility` | Set server visibility | Implemented (profilesettings.ts) |
| [x] | `profile set avatar background` | Set avatar background | Implemented (profilesettings.ts) |
| [x] | `profile set avatar border` | Set avatar border | Implemented (profilesettings.ts) |
| [x] | `profile set avatar shape` | Set avatar shape | Implemented (profilesettings.ts) |
| [x] | `profile set background` | Set profile background | ⭐ Implemented (profilesettings.ts) |
| [x] | `profile set color` | Set profile color | ⭐ Implemented (profilesettings.ts) |
| [x] | `profile set privacy` | Set privacy settings | Implemented (profilesettings.ts visibility) |
| [x] | `profile set visibility` | Set visibility | Implemented (profilesettings.ts) |

---

## Collection Commands (Playlists)

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `collections clone` | Clone a collection | Implemented (subcommand) |
| [x] | `collections delete` | Delete a collection | Implemented (subcommand) |
| [x] | `collection import` | Import playlist | ⭐ Implemented (importplaylist.ts) |
| [x] | `collections merge` | Merge collections | Implemented (subcommand) |
| [x] | `collections list` | List collections | Implemented (subcommand) |
| [x] | `collections create` | Create collection | Implemented (subcommand) |
| [x] | `collections save` | Save queue as collection | Implemented (subcommand) |
| [x] | `collections load` | Load/play collection | Implemented (subcommand) |

### Share Subcommands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `collections clone` | Copy from share code | Implemented (subcommand) |
| [x] | `collections share` | Create share code | Implemented (subcommand) |
| [x] | `collections unshare` | Remove share code | Implemented (subcommand) |
| [x] | `collection share codes` | List share codes | Implemented (sharecodes.ts) |
| [x] | `collections view` | View by share code | Implemented (subcommand) |

### Update Subcommands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `collections rename` | Rename collection | Implemented (subcommand) |
| [x] | `collection add` | Add tracks to collection | Implemented (subcommand) |
| [x] | `collection add current` | Add current to collection | Implemented (addcurrent subcommand) |
| [x] | `collection add unique` | Add unique tracks | Implemented (addunique.ts) |
| [x] | `collection remove` | Remove from collection | Implemented (subcommand) |

---

## Game Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `games` | List your games | Implemented |
| [x] | `guess the song` | Play guess the song | Implemented (guesssong.ts) |
| [x] | `leaderboard games` | Game leaderboard | Implemented (gameleaderboard.ts) |

---

## Settings Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `settings` | View all settings | Implemented |
| [x] | `settings reset` | Reset all settings | Implemented (setsettings.ts reset) |

### Track Settings

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `set max track length` | Set max track length | Implemented (limits.ts track max) |
| [x] | `set min track length` | Set min track length | Implemented (limits.ts track min) |

### Vote Skip Settings

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `set vote skip` | Enable/disable vote skip | Implemented (setsettings.ts voteskip) |
| [x] | `set vote skip percentage` | Set vote percentage | Implemented (setsettings.ts voteskip) |

### Playlist Settings

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `set max playlist length` | Set max playlist length | Implemented (limits.ts playlist maxlength) |
| [x] | `set max playlist tracks` | Set max playlist tracks | Implemented (limits.ts playlist maxtracks) |

### User Settings

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `set max user tracks` | Set max user tracks | Implemented (limits.ts user maxtracks) |
| [x] | `set max user tracks length` | Set max user length | Implemented (limits.ts user maxlength) |

### Announce Settings

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `set text announce` | Enable text announcements | Implemented (announceconfig.ts text toggle) |
| [x] | `set text announce auto delete` | Auto-delete announcements | Implemented (announceconfig.ts text autodelete) |
| [x] | `set text announce extended` | Extended announcements | Implemented (announceconfig.ts text extended) |
| [x] | `set stage announce` | Stage announcements | Implemented (announceconfig.ts stage toggle) |
| [x] | `set stage announce template` | Stage template | Implemented (announceconfig.ts stage template) |
| [x] | `set voice status announce` | Voice status updates | Implemented (announceconfig.ts voice toggle) |
| [x] | `set voice status announce template` | Status template | Implemented (announceconfig.ts voice template) |
| [x] | `set voice status announce default status` | Default status | Implemented (announceconfig.ts voice default) |
| [x] | `set voice announce` | Voice announcements | Implemented (voiceannounce.ts) |

### Default Settings

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `set default autoplay` | Default autoplay | Implemented (defaults.ts autoplay) |
| [x] | `set default repeat queue` | Default repeat | Implemented (defaults.ts repeatqueue) |
| [x] | `set default select random` | Default random | Implemented (defaults.ts selectrandom) |
| [x] | `set default shuffle repeat` | Default shuffle repeat | Implemented (defaults.ts shuffle) |
| [x] | `set default remove after played` | Default remove | Implemented (defaults.ts removeafterplayed) |
| [x] | `set default volume` | Default volume | Implemented (setsettings.ts defaultvolume) |

### Search Settings

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `set search type` | Default search type | Implemented (searchtype.ts) |

### Blacklist Settings

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `blacklist author` | Blacklist by author | Implemented (subcommand) |
| [x] | `blacklisted authors` | View blacklisted authors | Implemented (list subcommand) |
| [x] | `unblacklist author` | Remove author blacklist | Implemented (removeauthor subcommand) |
| [x] | `blacklist title` | Blacklist by title | Implemented (subcommand) |
| [x] | `blacklisted titles` | View blacklisted titles | Implemented (list subcommand) |
| [x] | `unblacklist title` | Remove title blacklist | Implemented (removetitle subcommand) |

---

## Permission Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `permission allow` | Allow permission | Implemented (permissions.ts subcommand) |
| [x] | `permission deny` | Deny permission | Implemented (permissions.ts subcommand) |
| [x] | `permissions` | View permissions | Implemented (permissions.ts) |
| [x] | `permissions allow all` | Allow all permissions | Implemented (permissions.ts subcommand) |
| [x] | `permissions deny all` | Deny all permissions | Implemented (permissions.ts subcommand) |
| [x] | `permissions reset` | Reset permissions | Implemented (permissions.ts subcommand) |

---

## Owner Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `claim ownership` | Claim session ownership | Implemented (ownership.ts subcommand) |
| [x] | `claim` | Claim session ownership (standalone) | NEW - Implemented (claim.ts) |
| [x] | `rebind` | Update announce channel | Implemented |
| [x] | `transfer ownership` | Transfer ownership | Implemented (ownership.ts subcommand) |
| [x] | `transfer` | Transfer ownership (standalone) | NEW - Implemented (transfer.ts) |

---

## Prefix Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `prefix list` | List prefixes | Implemented (prefix.ts) |
| [x] | `prefix server add` | Add server prefix | Implemented (prefix.ts) |
| [x] | `prefix server remove` | Remove server prefix | Implemented (prefix.ts) |
| [x] | `prefix server reset` | Reset server prefixes | Implemented (prefix.ts) |
| [x] | `prefix server set` | Set server prefix | Implemented (prefix.ts) |
| [x] | `prefix self add` | Add personal prefix | Implemented (selfprefix.ts add) |
| [x] | `prefix self combine` | Combine prefixes | Implemented (selfprefix.ts combine) |
| [x] | `prefix self remove` | Remove personal prefix | Implemented (selfprefix.ts remove) |
| [x] | `prefix self reset` | Reset personal prefixes | Implemented (selfprefix.ts reset) |
| [x] | `prefix self set` | Set personal prefix | Implemented (selfprefix.ts set) |

---

## Server Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `announce channel reset` | Reset announce channel | Implemented (announcer.ts reset) |
| [x] | `announce channel set` | Set announce channel | Implemented (announcer.ts channel) |
| [x] | `auto delete toggle` | Toggle auto-delete | Implemented (autodelete.ts) |
| [x] | `24/7` | 24/7 mode | ⭐ Implemented (247.ts) |
| [x] | `lock` | Lock session | Implemented |
| [x] | `multi bot ownership` | Multi-bot ownership | Implemented (serverconfig.ts multibotownership) |
| [x] | `preferred bots server` | Preferred bots | Implemented (serverconfig.ts preferredbots) |
| [x] | `dashboard statistics access` | Dashboard access | Implemented (serverconfig.ts dashboardaccess) |
| [x] | `page replace delete toggle` | Page replace delete | Implemented (serverconfig.ts pagereplacedelete) |
| [x] | `page delete toggle` | Page delete toggle | Implemented (serverconfig.ts pagedelete) |
| [x] | `timeout set` | Set timeout | Implemented (timeout.ts) |
| [x] | `timeouts` | View timeouts | Implemented (timeout.ts view) |

### Session Mode Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `session mode` | View session mode | Implemented (sessionmode.ts view) |
| [x] | `permission mode set` | Set permission mode | Implemented (sessionmode.ts permission) |
| [x] | `properties combine mode set` | Properties combine mode | Implemented (sessionmode.ts combine) |
| [x] | `properties mode set` | Properties mode | Implemented (sessionmode.ts properties) |
| [x] | `session mode set` | Set session mode | Implemented (sessionmode.ts set) |

### Command Availability

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `command disable all` | Disable all commands | Implemented (commanddisableall.ts) |
| [x] | `command disable` | Disable command | Implemented (commanddisable.ts) |
| [x] | `disabled commands` | View disabled commands | Implemented (disabledcommands.ts) |
| [x] | `command enable all` | Enable all commands | Implemented (commandenableall.ts) |
| [x] | `command enable` | Enable command | Implemented (commandenable.ts) |
| [x] | `command toggle` | Toggle command | Implemented (commandtoggle.ts) |

### Channel Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `text channel set delete original` | Text delete original | Implemented (textchannelconfig.ts deleteoriginal) |
| [x] | `text channel disable` | Disable text channel | Implemented (channels.ts text disable) |
| [x] | `text channel disable all` | Disable all text | Implemented logic in disable |
| [x] | `text channel enable` | Enable text channel | Implemented (channels.ts text enable) |
| [x] | `text channel enable all` | Enable all text | Implemented (channels.ts text enableall) |
| [x] | `text channel set message` | Set disabled message | Implemented (textchannelconfig.ts message) |
| [x] | `text channel set notify type` | Set notify type | Implemented (textchannelconfig.ts notifytype) |
| [x] | `text channel set thread policy` | Thread policy | Implemented (textchannelconfig.ts threadpolicy) |
| [x] | `text channel view` | View text channels | Implemented (channels.ts text view) |
| [x] | `voice channel disable` | Disable voice channel | Implemented (channels.ts voice disable) |
| [x] | `voice channel disable all` | Disable all voice | Implemented logic in disable |
| [x] | `voice channel enable` | Enable voice channel | Implemented (channels.ts voice enable) |
| [x] | `voice channel enable all` | Enable all voice | Implemented (channels.ts voice enableall) |
| [x] | `voice channel set message` | Set disabled message | Implemented (voicechannelconfig.ts message) |
| [x] | `voice channel view` | View voice channels | Implemented (channels.ts voice view) |

---

## User Commands

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `auto correct toggle` | Toggle auto-correct | Implemented (userprefs.ts autocorrect) |
| [x] | `preferred bots` | Set preferred bots | Implemented (userprefs.ts preferredbots) |
| [x] | `volume automatic toggle` | Auto volume toggle | Implemented (userprefs.ts volumeautomatic) |

---

## Custom Mappings

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `mappings add` | Add custom mapping | Implemented (mappings.ts) |
| [x] | `mappings clear` | Clear mappings | Implemented (mappings.ts) |
| [x] | `mappings list` | List mappings | Implemented (mappings.ts) |
| [x] | `mappings remove` | Remove mapping | Implemented (mappings.ts) |
| [x] | `mappings server add` | Add server mapping | Implemented (mappings.ts) |
| [x] | `mappings server clear` | Clear server mappings | Implemented (mappings.ts) |
| [x] | `mappings server list` | List server mappings | Implemented (mappings.ts) |
| [x] | `mappings server remove` | Remove server mapping | Implemented (mappings.ts) |

---

## Custom Aliases

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `alias add` | Add alias | Implemented (alias.ts subcommand) |
| [x] | `alias clear` | Clear aliases | Implemented (alias.ts subcommand) |
| [x] | `alias list` | List aliases | Implemented (alias.ts subcommand) |
| [x] | `alias remove` | Remove alias | Implemented (alias.ts subcommand) |
| [x] | `alias server add` | Add server alias | Implemented (alias.ts subcommand) |
| [x] | `alias server clear` | Clear server aliases | Implemented (alias.ts subcommand) |
| [x] | `alias server list` | List server aliases | Implemented (alias.ts subcommand) |
| [x] | `alias server remove` | Remove server alias | Implemented (alias.ts subcommand) |

---

## Premium Commands ⭐

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `perks` | View boost perks | Implemented (perks.ts) |
| [x] | `perks user` | View premium perks | Implemented (perks.ts subcommand) |
| [x] | `boost` | Boost a server | ⭐ Implemented (boost.ts) |
| [x] | `boosts` | View boosts | Implemented (boost.ts list + boosts.ts standalone) |
| [x] | `unboost` | Unboost a server | ⭐ Implemented (boost.ts deactivate + unboost.ts standalone) |

---

## Audio Filters (Premium) ⭐

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `8d` | 8D audio effect | Implemented ⭐ |
| [x] | `bassboost` | Bass boost effect | Implemented ⭐ |
| [x] | `clearfilters` | Clear all filters | Implemented |
| [x] | `distortion` | Distortion effect | Implemented ⭐ |
| [x] | `echo` | Echo effect | Implemented ⭐ |
| [x] | `filters` | View active filters | Implemented |
| [x] | `karaoke` | Karaoke effect | Implemented ⭐ |
| [x] | `pitch` | Change pitch | Implemented ⭐ |
| [x] | `pulsator` | Pulsator effect | Implemented ⭐ |
| [x] | `rate` | Change rate | Implemented ⭐ |
| [x] | `speed` | Change speed | Implemented ⭐ |
| [x] | `tremolo` | Tremolo effect | Implemented ⭐ |
| [x] | `vibrato` | Vibrato effect | Implemented ⭐ |

---

## Paging Commands (Utility)

*Note: These commands are used for text-based prefix command pagination. With slash commands, pagination is handled via interactive buttons on embeds rather than separate commands.*

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `previous page` | Previous page | Handled via embed buttons |
| [x] | `go to page` | Go to page | Handled via embed buttons |
| [x] | `next page` | Next page | Handled via embed buttons |
| [x] | `cancel` | Cancel paged message | Handled via embed buttons |
| [x] | `select` | Select entry | Handled via select menus |
| [x] | `renew` | Re-send paged message | Handled via embed buttons |

---

## Additional Implemented Commands

These are commands that exist in our bot but may not be in Jockie's API:

| Status | Command | Description | Notes |
|--------|---------|-------------|-------|
| [x] | `grab` | Save current track to DMs | Same as `save` |
| [x] | `nightcore` | Nightcore effect | Custom filter |
| [x] | `jump` | Jump to track | Alias for skipto |
| [x] | `play_file` | Play audio file | |
| [x] | `play_spotify` | Play Spotify tracks | |
| [x] | `playlist` | Playlist commands | |
| [x] | `patreon` | Patreon info | |
| [x] | `patreonadmin` | Patreon admin | |
| [x] | `setbitrate` | Set audio bitrate | |
| [x] | `resetbitrate` | Reset bitrate | |
| [x] | `uptime` | Bot uptime | |
| [x] | `stop` | Stop playback | |

---

## Summary

### Implemented Commands: 164 command files
### Total Expected Commands: ~200+
### Coverage: ~98%+ (All major features implemented)

### Commands Added Latest Session:
- `wind` - Wind to desired position in track
- `recentlyplayed` - View recently played tracks
- `repeat` - Unified repeat command with current/queue/disable/status subcommands
- `claim` - Standalone claim session ownership command
- `transfer` - Standalone transfer session ownership command
- `unboost` - Standalone unboost command
- `boosts` - Standalone view boosts command

### Commands Added Previous Session:
- `playselect` - Select tracks from playlist via menu
- `playsingle` - Queue single track from playlist by position
- `autodelete` - Toggle auto-delete bot messages
- `selectrandom` - Configure random track selection mode
- `removeafterplayed` - Auto-remove played tracks
- `shufflerepeat` - Shuffle on repeat mode
- `limits` - Track, playlist, and user limits (comprehensive)
- `announceconfig` - Text/stage/voice announcement settings
- `searchtype` - Default search platform setting
- `userprefs` - Personal user preferences
- `sessionmode` - Session and permission modes
- `selfprefix` - Personal prefix management
- `textchannelconfig` - Text channel settings (delete original, notify type, thread policy)
- `sharecodes` - List collection share codes
- `addunique` - Add only unique tracks
- `voiceannounce` - Voice TTS announcements
- `serverconfig` - Server-wide settings (multi-bot, dashboard access, page settings)
- `voicechannelconfig` - Voice channel disabled message
- Updated `defaults.ts` with selectrandom and removeafterplayed

### All Major Feature Areas Complete:
1. ✅ **Playback Commands** - All play, queue, and control commands
2. ✅ **Track State Commands** - Forward, backward, seek, wind, volume, etc.
3. ✅ **Queue Management** - Shuffle, sort, move, remove, etc.
4. ✅ **Information Commands** - Queue, nowplaying, history, recentlyplayed, etc.
5. ✅ **Profile Commands** - User profiles and customization
6. ✅ **Collection Commands** - Full collection/playlist management
7. ✅ **Game Commands** - Guess the song, leaderboards
8. ✅ **Settings Commands** - All server, channel, and user settings
9. ✅ **Permission Commands** - Full permission system
10. ✅ **Prefix/Mapping Commands** - Server and personal prefixes, mappings
11. ✅ **Premium Commands** - Boost, unboost, boosts, perks, audio filters
12. ✅ **Channel Restrictions** - Text and voice channel management
13. ✅ **Announcement Settings** - Text, voice, stage announcements
14. ✅ **Repeat Commands** - Unified repeat with multiple modes
15. ✅ **Ownership Commands** - Claim, transfer, ownership management
