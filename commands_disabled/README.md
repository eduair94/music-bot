# Disabled Commands

This folder contains 44 commands that were temporarily disabled to comply with Discord's limit of 100 global slash commands per application.

## Why were these commands disabled?

The bot had 164 commands, but Discord only allows a maximum of 100 global application commands.

## To re-enable commands

Move them back to the commands/ folder and rebuild:
```bash
mv commands_disabled/nightcore.ts commands/
npm run build
```

## Core Commands Kept (47 commands)

Essential music bot commands remain active including:
- Basic playback: play, pause, resume, stop, skip, previous, next
- Queue management: queue, clear, remove, move, shuffle
- Loop controls: loop, loopqueue, repeat
- And more...
