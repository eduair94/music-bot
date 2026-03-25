# ── Stage 1: Install ALL dependencies (cached unless package*.json changes) ──
FROM node:22-slim AS deps

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

# ── Stage 2: Build TypeScript (re-runs only when source changes) ─────────────
FROM deps AS build

COPY tsconfig.json ./
COPY index.ts ./
COPY commands ./commands
COPY interfaces ./interfaces
COPY locales ./locales
COPY models ./models
COPY services ./services
COPY shared ./shared
COPY structs ./structs
COPY utils ./utils
COPY workers ./workers

RUN npm run build

# ── Stage 3: Production dependencies only (cached with stage 1) ──────────────
FROM deps AS prod-deps
RUN npm prune --omit=dev

# ── Stage 4: Final slim image ────────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg python3 python3-pip curl ca-certificates && \
    # Install yt-dlp nightly for latest YouTube fixes
    pip install --break-system-packages yt-dlp[default]@https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.tar.gz && \
    apt-get purge -y curl && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/* /root/.cache/pip

COPY --from=build /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/locales ./locales

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]