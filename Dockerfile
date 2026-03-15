# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

COPY --from=builder /app/.output ./.output

ENV PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
