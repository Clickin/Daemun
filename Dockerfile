# =========================
# Builder Stage
# =========================
ARG NODE_IMAGE=node:26-alpine3.23
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

RUN npm install -g pnpm@11.1.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY docs-site/package.json ./docs-site/package.json
COPY runtime-deps/package.json ./runtime-deps/package.json
RUN pnpm install --frozen-lockfile

COPY . .

ARG CI
ARG BUILDTIME
ARG VERSION
ARG REVISION
ENV CI=$CI
ENV VITE_BUILDTIME=$BUILDTIME
ENV VITE_VERSION=$VERSION
ENV VITE_REVISION=$REVISION

RUN if [ "$CI" != "true" ]; then \
      pnpm run build; \
    else \
      echo "Using prebuilt app from CI context"; \
    fi

# =========================
# Native Runtime Dependencies Stage
# =========================
FROM ${NODE_IMAGE} AS runtime-deps
WORKDIR /app

RUN npm install -g pnpm@11.1.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY runtime-deps/package.json ./runtime-deps/package.json
RUN node -e "const p = require('./runtime-deps/package.json'); const deps = { ...(p.dependencies || {}), ...(p.optionalDependencies || {}) }; process.exit(Object.keys(deps).length === 0 ? 0 : 1)" \
      && mkdir -p /runtime-deps/node_modules \
      || pnpm --filter @daemun/runtime-native-deps deploy --prod --legacy /runtime-deps

# =========================
# Runtime Stage
# =========================
FROM ${NODE_IMAGE} AS runner
LABEL org.opencontainers.image.title="Daemun"
LABEL org.opencontainers.image.description="A Hono-powered self-hosted dashboard for homelab services, widgets, and YAML-compatible Homepage configurations."
LABEL org.opencontainers.image.url="https://github.com/Clickin/Daemun"
LABEL org.opencontainers.image.documentation='https://github.com/Clickin/Daemun'
LABEL org.opencontainers.image.source='https://github.com/Clickin/Daemun'
LABEL org.opencontainers.image.licenses='GPL-3.0-only'

WORKDIR /app

COPY --link --from=builder --chown=1000:1000 /app/dist ./dist
COPY --link --from=runtime-deps --chown=1000:1000 /runtime-deps/node_modules ./node_modules
COPY --link --from=builder --chown=1000:1000 /app/package.json ./package.json
COPY --link --from=builder --chown=1000:1000 /app/public ./public
COPY --link --from=builder --chown=1000:1000 /app/src/skeleton ./src/skeleton
COPY --link --chmod=755 docker-entrypoint.sh /usr/local/bin/

RUN apk add --no-cache su-exec iputils-ping shadow

USER root

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/healthcheck || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server/index.mjs", "--host", "0.0.0.0", "--port", "3000"]
