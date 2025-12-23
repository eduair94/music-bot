# Ì∑™ Testing & Development Commands

This document describes owner-only commands for testing and development purposes.

## Owner Commands

### `/setbitrate` - Set Custom Audio Quality

**Description:** Allows the bot owner to set custom audio bitrate for testing different quality tiers.

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
  - Use `"indie"` for the special Ìæ∏ Indie Music Bot branding
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
- ‚úÖ Confirmation message
- Quality badge (e.g., "Ì¥ä HQ 320kbps (Premium)")
- Bot identity (e.g., "Ìæ∏ Indie Music Bot" or "Bypass")
- Notification that settings will apply to all music commands

---

### `/resetbitrate` - Reset to Default Settings

**Description:** Resets audio bitrate to default (128kbps) or Patreon-determined settings.

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
- ‚úÖ Confirmation that settings were reset
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
1. Enable Developer Mode in Discord (User Settings ‚Üí Advanced ‚Üí Developer Mode)
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
# Should show: "Ì¥ä HQ 320kbps ‚Ä¢ Ìæ∏ Indie Music Bot"

# Test Tier 2 - Premium ($10-14.99)
/setbitrate bitrate:320 identity:premium
/play some song
# Should show: "Ì¥ä HQ 320kbps ‚Ä¢ premium"

# Test Tier 3 - Founder ($15+)
/setbitrate bitrate:320 identity:founder
/play some song
# Should show: "Ì¥ä HQ 320kbps ‚Ä¢ founder"

# Reset to default
/resetbitrate
```

### Testing All Commands with Quality Display

All music playback commands will show the quality badge:
- `/play` - Regular YouTube playback
- `/play_spotify` - Spotify search ‚Üí YouTube
- `/play_file` - File upload playback
- `/playlist` - Playlist playback

Each will display in the embed footer:
```
Ì¥ä HQ 320kbps ‚Ä¢ Ìæ∏ Indie Music Bot ‚Ä¢ Requested by Username
```

---

## Quality Badge Reference

| Bitrate | Badge | Tier |
|---------|-------|------|
| 128 kbps | Ì¥â 128kbps | Free |
| 192 kbps | Ì¥â 192kbps | Mid |
| 256 kbps | Ì¥ä 256kbps (High) | High |
| 320 kbps | Ì¥ä HQ 320kbps (Premium) | Premium |

## Bot Identity Reference

| Identity | Display | Default Tier |
|----------|---------|--------------|
| (none) | Bypass | Free users |
| `indie` | Ìæ∏ Indie Music Bot | Tier 1 ($5-9.99) |
| `premium` | premium | Tier 2 ($10-14.99) |
| `founder` | founder | Tier 3 ($15+) |
| (custom) | (custom text) | Testing |

---

## Notes

- ‚ö†Ô∏è These commands are **owner-only** and require the `OWNER_ID` to be configured
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

## Ìºü Premium Guild System

### Overview
The premium system is now **server-based** instead of user-based. Patreon supporters can link multiple servers based on their tier, and each server gets its own premium configuration.

### Server Limits by Tier

| Tier | Pledge Amount | Max Servers | Audio Quality | Default Identity |
|------|---------------|-------------|---------------|------------------|
| Free | $0 | 0 | 128 kbps | Bypass |
| Tier 1 | $5-9.99/month | 1 server | 320 kbps | Ìæ∏ Indie Music Bot |
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
‚úÖ Server linked successfully!

Ìæµ Audio Quality: 320kbps
Ìæ∏ Bot Identity: Indie Music Bot  
Ì≥ä Servers: 1/1

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
‚úÖ Server unlinked successfully!

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

**Response:**
```
Ì∑ÇÔ∏è Your Linked Servers

1. My Gaming Server
   Ìæµ 320kbps ‚Ä¢ Ìæ∏ Indie Music Bot
   Ì≥Ö Linked: 2 days ago

2. Music Community
   Ìæµ 320kbps ‚Ä¢ Premium
   Ì≥Ö Linked: 1 week ago

Ì≥ä Server Slots: 2/3 used
Ì≤é Patreon Tier: Supporter
```

---

### `/premium status`
Show premium status for the current server.

**Example:**
```
/premium status
```

**Response (Premium Server):**
```
‚ú® Premium Server

This server has premium features enabled!

Ìæµ Audio Quality: Ì¥ä HQ 320kbps
Ìæ∏ Bot Identity: Ìæ∏ Indie Music Bot
Ì≥Ö Linked: 3 days ago
‚è∞ Last Used: 5 minutes ago

You own this premium link
```

**Response (Free Server):**
```
Ì∂ì Free Server

This server is using free tier.

Use `/premium link` to enable premium features.

Ìæµ Audio Quality: ÔøΩÔøΩ 128kbps (Free)
Ìæ∏ Bot Identity: Bypass
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

# Change bot identity
/premium config identity:MyCustomBot

# Change both
/premium config bitrate:256 identity:indie
```

**Response:**
```
‚öôÔ∏è Settings Updated

Ìæµ Audio Quality: 320kbps
Ìæ∏ Bot Identity: Indie Music Bot
```

---

## Premium Features Per Server

When a server is linked to a Patreon account, **all users** in that server get:

- ‚úÖ High-quality audio (up to 320kbps)
- ‚úÖ Custom bot identity branding
- ‚úÖ Premium features (based on tier)
- ‚úÖ Priority support access

**Important:** Premium is tied to the **server**, not individual users.

---

## Testing Premium System

### As Bot Owner

Use `/setbitrate` to simulate premium for testing:

```bash
# Test as if server is premium
/setbitrate bitrate:320 identity:indie

# Test as if server is free
/setbitrate bitrate:128

# Reset to use actual premium status
/resetbitrate
```

### As Patreon Supporter

1. Link your Discord account on Patreon
2. Wait for sync (or use `/patreon sync`)
3. Use `/premium link` in your server
4. Verify with `/premium status`
5. Test playback commands to see quality badge

---

## Migration from User-Based to Server-Based

### Old System (Deprecated)
- Audio quality tied to individual users
- Each user had their own bitrate setting
- Inconsistent experience across servers

### New System (Current)
- Audio quality tied to servers
- One Patreon supporter enables premium for entire server
- Consistent experience for all server members
- Multiple server support based on tier

### Backward Compatibility
- Old user-based settings are ignored
- Use `/setbitrate` for owner testing only
- Production uses server-based premium system

---

## Technical Details

### Database Models

**PremiumGuild Model:**
```typescript
{
  guildId: string           // Discord server ID
  discordId: string         // Patreon supporter's Discord ID
  patreonId: string         // Patreon user ID
  audioBitrate: number      // 128, 192, 256, or 320
  customBotName: string     // Custom identity
  isActive: boolean         // Premium active status
  linkedAt: Date            // When linked
  lastUsed: Date            // Last premium use
}
```

### Audio Quality Resolution
1. Check if server has premium link (`PremiumGuild`)
2. If yes: Use server's configured bitrate
3. If no: Default to 128kbps (free tier)
4. Display quality badge in playback embeds

### Server Limit Enforcement
- Tier 1: 1 server maximum
- Tier 2: 3 servers maximum  
- Tier 3: 10 servers maximum
- Enforced when using `/premium link`
- Can unlink servers to free up slots

---

## Common Scenarios

### Scenario 1: Server Owner is Patreon Supporter
```bash
# Owner links their server
/premium link

# All members get premium audio
/play some song
# Shows: "Ì¥ä HQ 320kbps ‚Ä¢ Ìæ∏ Indie Music Bot"
```

### Scenario 2: Regular User in Premium Server
```bash
# User checks premium status
/premium status
# Shows: "‚ú® Premium Server - Premium provided by another user"

# User plays music
/play some song
# Gets 320kbps audio quality automatically
```

### Scenario 3: Supporter with Multiple Servers
```bash
# Check current usage
/premium list
# Shows: "Servers: 2/3 used"

# Link another server
/premium link
# Success if under limit

# Exceeded limit
/premium link
# Error: "You've reached your server limit"

# Free up slot
/premium unlink
# In old server, then link new server
```

### Scenario 4: Server Changes Ownership
```bash
# New owner wants to link their Patreon
# First, old link must be removed
/premium unlink  # Old owner

# Then new owner can link
/premium link    # New owner
```

---

## FAQ

**Q: Can multiple Patreon supporters link the same server?**  
A: No, only one Patreon account can have premium active per server at a time.

**Q: What happens if my Patreon membership expires?**  
A: Linked servers will revert to free tier (128kbps) after the next sync.

**Q: Can I transfer my server slots to another user?**  
A: No, server slots are tied to your Patreon account.

**Q: Do I need to relink servers every month?**  
A: No, links persist as long as your Patreon membership is active.

**Q: Can I have different quality settings for different servers?**  
A: Yes! Use `/premium config` in each server to customize settings.

**Q: What if I want to upgrade/downgrade my tier?**  
A: Server limits adjust automatically. You may need to unlink servers if downgrading.

---

