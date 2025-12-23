# �️ Testing & Development Commands

This document describes owner-only commands for testing and development purposes.

> **Note:** These commands do NOT require Administrator permissions in Discord. They are restricted by the `OWNER_ID` config value only. The bot owner can use them regardless of their server permissions.

## Owner Commands

### `/setbitrate` - Set Custom Audio Quality

**Description:** Allows the bot owner to set custom audio bitrate for testing different quality tiers.

**Permissions:** Owner only (configured via `OWNER_ID` in config.json). Does not require Discord Administrator permission.

**Usage:**
```
/setbitrate bitrate:<128|192|256|320> [identity:<custom_name>] [user:<@user>]
```

**Parameters:**
- `bitrate` (required): Audio quality in kbps
  - `128 kbps` - Free tier quality
  - `192 kbps` - Mid tier quality
  - `256 kbps` - High tier quality
  - `320 kbps` - Premium tier quality (HQ)
  
- `identity` (optional): Custom bot identity/branding
  - Use `"indie"` for the special � Indie Music Bot branding
  - Or any custom name for testing
  
- `user` (optional): Target user to set bitrate for
  - Defaults to yourself if not specified
  - Allows testing different users' experiences

**Examples:**
```
# Set yourself to 320kbps with indie branding
/setbitrate bitrate:320 identity:indie

# Set 192kbps quality for yourself
/setbitrate bitrate:192

# Set another user to premium quality
/setbitrate bitrate:320 identity:premium user:@SomeUser

# Test free tier experience
/setbitrate bitrate:128
```

**Response:**
The command will show:
- ✅ Confirmation message
- Quality badge (e.g., "� HQ 320kbps (Premium)")
- Bot identity (e.g., "� Indie Music Bot" or "Bypass")
- Notification that settings will apply to all music commands

---

### `/resetbitrate` - Reset to Default Settings

**Description:** Resets audio bitrate to default (128kbps) or Patreon-determined settings.

**Permissions:** Owner only (configured via `OWNER_ID` in config.json). Does not require Discord Administrator permission.

**Usage:**
```
/resetbitrate [user:<@user>]
```

**Parameters:**
- `user` (optional): User to reset settings for
  - Defaults to yourself if not specified

**Examples:**
```
# Reset your own settings
/resetbitrate

# Reset another user's settings
/resetbitrate user:@SomeUser
```

**Response:**
- ✅ Confirmation that settings were reset
- Shows default quality (128kbps)
- Note that Patreon tier will now be used if applicable

---

## Configuration

### Setting the Owner ID

The owner ID must be configured in your `config.json`:

```json
{
  "OWNER_ID": "1066182746399055993",
  ...
}
```

Or via environment variable:
```bash
OWNER_ID=1066182746399055993
```

**How to find your Discord User ID:**
1. Enable Developer Mode in Discord (User Settings -> Advanced -> Developer Mode)
2. Right-click your username
3. Click "Copy User ID"

---

## Testing Workflow

### Testing Different Quality Tiers

```bash
# Test Free Tier (128kbps)
/setbitrate bitrate:128
/play some song

# Test Tier 1 - Indie ($5-9.99)
/setbitrate bitrate:320 identity:indie
/play some song
# Should show: "� HQ 320kbps - � Indie Music Bot"

# Test Tier 2 - Premium ($10-14.99)
/setbitrate bitrate:320 identity:premium
/play some song
# Should show: "� HQ 320kbps - premium"

# Test Tier 3 - Founder ($15+)
/setbitrate bitrate:320 identity:founder
/play some song
# Should show: "� HQ 320kbps - founder"

# Reset to default
/resetbitrate
```

### Testing All Commands with Quality Display

All music playback commands will show the quality badge:
- `/play` - Regular YouTube playback
- `/play_spotify` - Spotify search -> YouTube
- `/play_file` - File upload playback
- `/playlist` - Playlist playback

Each will display in the embed footer:
```
� HQ 320kbps - � Indie Music Bot - Requested by Username
```

---

## Quality Badge Reference

| Bitrate | Badge | Tier |
|---------|-------|------|
| 128 kbps | � 128kbps | Free |
| 192 kbps | � 192kbps | Mid |
| 256 kbps | � 256kbps (High) | High |
| 320 kbps | � HQ 320kbps (Premium) | Premium |

## Bot Identity Reference

| Identity | Display | Default Tier |
|----------|---------|--------------|
| (none) | Bypass | Free users |
| `indie` | � Indie Music Bot | Tier 1 ($5-9.99) |
| `premium` | premium | Tier 2 ($10-14.99) |
| `founder` | founder | Tier 3 ($15+) |
| (custom) | (custom text) | Testing |

---

## Notes

- ⚠️ These commands are **owner-only** and require the `OWNER_ID` to be configured
- Changes are immediate and stored in the database
- Settings persist across bot restarts
- Real Patreon tier settings will override manual settings when synced
- Use `/resetbitrate` to remove manual overrides and rely on Patreon data

---

## Troubleshooting

**Command not showing up:**
- Ensure `OWNER_ID` is correctly set in `config.json`
- Restart the bot after adding the owner ID
- Re-deploy slash commands if needed

**Settings not applying:**
- Check MongoDB connection
- Verify PatreonUser model is properly configured
- Check console logs for errors

**Quality not changing:**
- Audio encoding is logged but actual stream quality depends on discord-player configuration
- The quality badge is visual feedback for testing the tier system
- Future updates may implement actual audio encoding changes

---

## � Premium Guild System

### Overview
The premium system is now **server-based** instead of user-based. Patreon supporters can link multiple servers based on their tier, and each server gets its own premium configuration.

### Server Limits by Tier

| Tier | Pledge Amount | Max Servers | Audio Quality | Default Identity |
|------|---------------|-------------|---------------|------------------|
| Free | $0 | 0 | 128 kbps | Bypass |
| Tier 1 | $5-9.99/month | 1 server | 320 kbps | � Indie Music Bot |
| Tier 2 | $10-14.99/month | 3 servers | 320 kbps | Premium |
| Tier 3 | $15+/month | 10 servers | 320 kbps | Founder |

---

## `/premium` Command Suite

### `/premium link`
Link the current server to your Patreon account.

**Requirements:**
- Active Patreon membership
- Available server slot
- Server not already linked by another user

**Example:**
```
/premium link
```

**Response:**
```
✅ Server linked successfully!

� Audio Quality: 320kbps
� Bot Identity: Indie Music Bot  
� Servers: 1/1

Premium features are now active in this server!
```

---

### `/premium unlink`
Unlink the current server from your Patreon account.

**Example:**
```
/premium unlink
```

**Response:**
```
✅ Server unlinked successfully!

Premium features have been disabled for this server.
You can link another server with your available slots.
```

---

### `/premium list`
Show all servers linked to your Patreon account.

**Example:**
```
/premium list
```

---

### `/premium status`
Show premium status for the current server.

**Example:**
```
/premium status
```

---

### `/premium config`
Configure premium settings for the current server (owner only).

**Parameters:**
- `bitrate` (optional): Audio quality (128, 192, 256, 320 kbps)
- `identity` (optional): Custom bot identity name

**Examples:**
```
# Set maximum audio quality
/premium config bitrate:320

# Set custom identity
/premium config identity:indie

# Set both
/premium config bitrate:320 identity:"My Custom Bot"
```

---

## FAQ

**Q: Can multiple users link premium to the same server?**
A: No, only one premium link per server. First come, first served.

**Q: What happens if I downgrade my tier?**
A: Excess servers will be automatically unlinked (oldest first).

**Q: Can I transfer my premium to another server?**
A: Yes! Use `/premium unlink` then `/premium link` in the new server.

**Q: Does premium apply to all channels?**
A: Yes, premium applies server-wide to all voice channels.
