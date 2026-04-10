# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Bundle the migration script into a standalone .mjs
RUN pnpm exec esbuild src/db/migrate.ts \
  --bundle --platform=node --format=esm --outfile=migrate.mjs

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrate.mjs ./migrate.mjs
COPY --from=builder /app/src/db/migrations ./migrations
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

ENV PORT=3000
ENV LOG_DIR=/data/logs
EXPOSE 3000

VOLUME ["/data"]

CMD ["./docker-entrypoint.sh"]
