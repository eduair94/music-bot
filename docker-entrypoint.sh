#!/bin/sh
set -e

# ── cookies.txt handling ───────────────────────────────────────
# Docker bind-mounts create an empty directory if the source file
# doesn't exist on the host.  Detect that and clean up so the bot
# treats it as "no cookies provided".
if [ -e /app/cookies.txt ]; then
  if [ -d /app/cookies.txt ]; then
    # Docker created an empty directory – remove it
    echo "[entrypoint] ⚠️  cookies.txt is a directory (file not found on host), removing"
    rm -rf /app/cookies.txt 2>/dev/null || true
  elif [ ! -s /app/cookies.txt ]; then
    # File exists but is empty – truncate it (rm fails on bind mounts)
    echo "[entrypoint] ⚠️  cookies.txt is empty, ignoring"
    : > /app/cookies.txt 2>/dev/null || true
  else
    echo "[entrypoint] 🍪 cookies.txt found ($(wc -c < /app/cookies.txt) bytes)"
  fi
else
  echo "[entrypoint] ℹ️  No cookies.txt mounted"
fi

# Hand off to the main process
exec "$@"
