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

# ── yt-dlp freshness ───────────────────────────────────────────
# The image bakes whichever nightly was current at build time, and
# YouTube starts rejecting old builds within weeks (HTTP 403 on every
# media URL).  Refresh on each start so a long-lived container can't
# rot, but never block startup if PyPI/GitHub is unreachable.
# Set YTDLP_SKIP_UPDATE=1 to keep the baked version (offline hosts).
if [ "${YTDLP_SKIP_UPDATE:-0}" = "1" ]; then
  echo "[entrypoint] ⏭️  yt-dlp update skipped ($(yt-dlp --version 2>/dev/null || echo 'not installed'))"
else
  echo "[entrypoint] ⬆️  Updating yt-dlp (baked: $(yt-dlp --version 2>/dev/null || echo 'not installed'))"
  if pip install --break-system-packages -q -U \
      "yt-dlp[default] @ https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.tar.gz" 2>/dev/null; then
    echo "[entrypoint] ✅ yt-dlp now $(yt-dlp --version 2>/dev/null)"
  else
    echo "[entrypoint] ⚠️  yt-dlp update failed, continuing with $(yt-dlp --version 2>/dev/null || echo 'no yt-dlp')"
  fi
fi

# Hand off to the main process
exec "$@"
