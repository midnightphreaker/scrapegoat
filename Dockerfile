# Build stage
FROM node:22-slim AS builder

ARG POSTHOG_API_KEY
ENV POSTHOG_API_KEY=$POSTHOG_API_KEY

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  python3 make g++ nodejs npm \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY src/web-sveltekit/package*.json ./src/web-sveltekit/

RUN npm pkg delete overrides.baseline-browser-mapping >/dev/null 2>&1 || true
RUN npm i -D baseline-browser-mapping@latest --package-lock-only --legacy-peer-deps
RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

RUN rm -rf node_modules && npm ci --omit=dev --legacy-peer-deps

# Production stage
FROM node:22-slim

WORKDIR /app

COPY db db


COPY --from=builder /app               .
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/public        ./public
COPY --from=builder /app/node_modules  ./node_modules

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/* /tmp/* \
  && CHROMIUM_PATH=$(command -v chromium || command -v chromium-browser) \
  && if [ -z "$CHROMIUM_PATH" ]; then echo "Chromium not found!" && exit 1; fi \
  && echo "Chromium at $CHROMIUM_PATH"

ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV DOCS_MCP_STORE_PATH=/data
ENV PORT=8080
ENV HOST=0.0.0.0

VOLUME /data
EXPOSE 8080

ENTRYPOINT ["node", "dist/index.js"]
