FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@9

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/sdk/package.json ./packages/sdk/
RUN pnpm install --frozen-lockfile

# Test stage - contains all dependencies for running tests in CI
FROM base AS test
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
# Tests can be run using: docker run --rm <image> pnpm test:ci

# Build application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=8192"

# Client-side Sentry configuration (bundled at build time)
ARG VITE_SENTRY_DSN
ARG VITE_SENTRY_ENVIRONMENT=production
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
ENV VITE_SENTRY_ENVIRONMENT=${VITE_SENTRY_ENVIRONMENT}

RUN pnpm run build

# Production runtime - Web Server
FROM node:22-alpine AS runner

WORKDIR /app

# Copy build output
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy migration files for running migrations via: node server/db/migrate.mjs
COPY --from=builder /app/server/db/migrations ./server/db/migrations
COPY --from=builder /app/server/db/migrate.mjs ./server/db/migrate.mjs

# Set production environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/server/server.js"]

