# =========================
# Builder Stage
# =========================
FROM node:26-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@10.32.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG CI
ARG BUILDTIME
ARG VERSION
ARG REVISION
ENV CI=$CI
ENV NEXT_PUBLIC_BUILDTIME=$BUILDTIME
ENV NEXT_PUBLIC_VERSION=$VERSION
ENV NEXT_PUBLIC_REVISION=$REVISION

RUN if [ "$CI" != "true" ]; then \
      pnpm run build; \
    else \
      echo "Using prebuilt app from CI context"; \
    fi

RUN pnpm prune --prod

# =========================
# Runtime Stage
# =========================
FROM node:26-alpine AS runner
LABEL org.opencontainers.image.title="Homepage"
LABEL org.opencontainers.image.description="A self-hosted services landing page, with docker and service integrations."
LABEL org.opencontainers.image.url="https://github.com/gethomepage/homepage"
LABEL org.opencontainers.image.documentation='https://github.com/gethomepage/homepage/wiki'
LABEL org.opencontainers.image.source='https://github.com/gethomepage/homepage'
LABEL org.opencontainers.image.licenses='Apache-2.0'

WORKDIR /app

COPY --link --from=builder --chown=1000:1000 /app/dist ./dist
COPY --link --from=builder --chown=1000:1000 /app/node_modules ./node_modules
COPY --link --from=builder --chown=1000:1000 /app/package.json ./package.json
COPY --link --from=builder --chown=1000:1000 /app/public ./public
COPY --link --from=builder --chown=1000:1000 /app/src/skeleton ./src/skeleton
COPY --link --chmod=755 docker-entrypoint.sh /usr/local/bin/

RUN apk add --no-cache su-exec iputils-ping shadow

USER root

ENV NODE_ENV=production
ENV HOSTNAME=::
ENV PORT=3000
EXPOSE $PORT

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:$PORT/api/healthcheck || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server/index.mjs"]
