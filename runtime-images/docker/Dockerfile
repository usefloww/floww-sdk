# ---- build stage ----
FROM node:22 AS build

RUN npm install -g pnpm@10.9.0 esbuild@0.25.10

WORKDIR /app
COPY runtime-images/docker/src ./src

RUN esbuild src/server.ts \
  --bundle --platform=node --format=esm --target=node22 \
  --external:floww \
  --external:fastify \
  --outfile=server.mjs

# ---- runtime stage ----
FROM node:22-slim AS runtime

# Install minimal runtime dependencies
WORKDIR /app

# Copy bundled server
COPY --from=build /app/server.mjs /app/server.mjs
RUN echo '{"type":"module"}' > /app/package.json

# Expose HTTP port
EXPOSE 8000

# Set environment variables
ENV PORT=8000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:8000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Start the server
CMD ["node", "server.mjs"]

FROM runtime AS default

ARG SDK_VERSION=latest
RUN echo "{\"type\":\"module\",\"dependencies\":{\"floww\":\"${SDK_VERSION}\",\"fastify\":\"^5.6.0\"}}" > package.json && \
    npm install
    