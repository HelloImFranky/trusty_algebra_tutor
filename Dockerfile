# syntax=docker/dockerfile:1
# Single-image build of the whole app: the Next.js server hosts the student
# PWA, the tRPC API, and the scaffold images on ONE port, and runs the
# database migrations + curriculum seed itself on startup. This is what makes
# `docker compose up` and `fly deploy` one-step for teachers.
#
# The --mount=type=cache mounts persist npm's download cache and Next's
# incremental compiler cache across builds (Docker BuildKit and Fly's Depot
# builders both keep them), so rebuilds after a code change are fast.
FROM node:22-slim AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=1

# Prisma needs OpenSSL present to pick the right query-engine binary.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install with just the manifests first for layer caching. @tutor/db's
# postinstall needs its prisma schema + migration embed script.
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY apps/native/package.json apps/native/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/db/migrations packages/db/migrations
COPY packages/db/scripts packages/db/scripts
COPY packages/api/package.json packages/api/
COPY packages/app/package.json packages/app/
RUN --mount=type=cache,id=npm,target=/root/.npm \
  mkdir -p packages/db/src && (npm ci || npm install)

COPY . .
RUN --mount=type=cache,id=nextcache,target=/repo/apps/web/.next/cache \
  npm run generate --workspace @tutor/db && npx turbo build --filter=@tutor/web

# ---- runtime ---------------------------------------------------------------
FROM node:22-slim
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/data
# 8080 matches Fly's conventional internal port (and fly.toml / compose).
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Prisma's query engine links against libssl at runtime.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Next standalone output carries its own traced node_modules (incl. Prisma's
# query engine); static assets and public/ ride alongside.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static apps/web/.next/static
COPY --from=build /repo/apps/web/public apps/web/public

# Persist the auto-generated JWT secret across restarts.
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8080
CMD ["node", "apps/web/server.js"]
