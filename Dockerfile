# Single-image build of the whole app: the Next.js server hosts the student
# PWA, the tRPC API, and the scaffold images on ONE port, and runs the
# database migrations + curriculum seed itself on startup. This is what makes
# `docker compose up` and `fly deploy` one-step for teachers.
FROM node:22-slim AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

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
RUN mkdir -p packages/db/src && npm ci --omit=optional || npm install

COPY . .
RUN npm run generate --workspace @tutor/db && npx turbo build --filter=@tutor/web

# ---- runtime ---------------------------------------------------------------
FROM node:22-slim
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/data
ENV PORT=3000

# Next standalone output carries its own traced node_modules (incl. Prisma's
# query engine); static assets and public/ ride alongside.
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static apps/web/.next/static
COPY --from=build /repo/apps/web/public apps/web/public

# Persist the auto-generated JWT secret across restarts.
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
