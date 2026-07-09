# Single-image build: compiles the web PWA and the API, then runs the API
# which serves BOTH the frontend and the API on one port. This is what makes
# one-click / one-command hosting possible — one service, one URL.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm install
COPY . .
RUN npm run build --workspace web && npm run build --workspace server

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV WEB_DIST=/app/web/dist
ENV DATA_DIR=/data
# Prod deps only (both workspace manifests are needed for npm to resolve the tree).
COPY package.json package-lock.json* ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm install --omit=dev --workspace server && npm cache clean --force
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/migrations server/migrations
COPY --from=build /app/web/dist web/dist
# Persist the auto-generated JWT secret across restarts.
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 4000
CMD ["node", "server/dist/index.js"]
