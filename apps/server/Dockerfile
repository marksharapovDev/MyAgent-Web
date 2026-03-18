# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json    ./packages/core/
COPY apps/server/package.json      ./apps/server/

RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json            ./
COPY packages/shared               ./packages/shared
COPY packages/core                 ./packages/core
COPY apps/server                   ./apps/server

# Build in dependency order
RUN pnpm --filter @my-agent/shared build
RUN pnpm --filter @my-agent/core   build
RUN pnpm --filter @my-agent/server build

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests for prod install
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json    ./packages/core/
COPY apps/server/package.json      ./apps/server/

RUN pnpm install --prod --frozen-lockfile

# Copy compiled output from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/core/dist    ./packages/core/dist
COPY --from=builder /app/apps/server/dist      ./apps/server/dist

# Projects volume mount point
RUN mkdir -p /app/projects

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
