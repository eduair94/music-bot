# ── Stage 1: Build ────────────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /app

# Install build tools for native modules (opus, sodium, etc.)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Prune to production deps only
RUN rm -rf node_modules && npm ci --omit=dev

# ── Stage 2: Production ──────────────────────────────────────
FROM node:22-slim

WORKDIR /app

# Install runtime dependencies: ffmpeg + yt-dlp + python3 (needed by yt-dlp)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 curl ca-certificates && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get purge -y curl && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Copy built app & production node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/locales ./locales

# Entrypoint script handles cookies.txt validation
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]