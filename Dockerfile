# Build stage
FROM node:22-slim AS builder

# Accept build argument for PostHog API key
ARG POSTHOG_API_KEY
ENV POSTHOG_API_KEY=$POSTHOG_API_KEY

WORKDIR /app

# Install build dependencies for native modules (tree-sitter)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  nodejs \
  npm \
  && rm -rf /var/lib/apt/lists/*

# Copy package files (root and workspace)
COPY package*.json ./
COPY src/web-sveltekit/package*.json ./src/web-sveltekit/

# Force-refresh baseline-browser-mapping (avoids stale Baseline dataset warnings)
RUN npm pkg delete overrides.baseline-browser-mapping >/dev/null 2>&1 || true

RUN npm i -D baseline-browser-mapping@latest --package-lock-only --legacy-peer-deps

# Install all dependencies including workspace (web-sveltekit)
# Using --legacy-peer-deps to resolve @langchain dependency conflicts
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build application
RUN npm run build

# Install production dependencies in a clean directory
RUN rm -rf node_modules && npm ci --omit=dev --legacy-peer-deps

# Production stage
FROM node:22-slim

WORKDIR /app

# Copy package files and database
COPY package*.json .
COPY db            db

# Copy built files and production node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Install system Chromium and required dependencies
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* \
  && CHROMIUM_PATH=$(command -v chromium || command -v chromium-browser) \
  && if [ -z "$CHROMIUM_PATH" ]; then echo "Chromium executable not found!" && exit 1; fi \
  && if [ "$CHROMIUM_PATH" != "/usr/bin/chromium" ]; then echo "Unexpected Chromium path: $CHROMIUM_PATH" && exit 1; fi \
  && echo "Chromium installed at $CHROMIUM_PATH"

RUN apt-get update \
    && apt-get install -y \
    nodejs \
    npm && npm install -g npm@11.11.0

# Set Playwright to use system Chromium (hardcoded path, as ENV cannot use shell vars)
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Set data directory for the container
ENV DOCS_MCP_STORE_PATH=/data

# Define volumes
VOLUME /data

# Expose the default port of the application
EXPOSE 8080
ENV PORT=8080
ENV HOST=0.0.0.0

# Set the command to run the application
ENTRYPOINT ["node", "dist/index.js"]
