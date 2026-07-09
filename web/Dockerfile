FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY web/package.json web/
RUN npm install --workspace web
COPY web web
RUN npm run build --workspace web

FROM nginx:alpine
COPY --from=build /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
