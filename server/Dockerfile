FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/
RUN npm install --workspace server
COPY server server
RUN npm run build --workspace server

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server/dist server/dist
COPY server/package.json server/
COPY server/migrations server/migrations
EXPOSE 4000
CMD ["node", "server/dist/index.js"]
