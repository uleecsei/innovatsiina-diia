FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install -g pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm backend:build

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist/innovatsiina-diia ./dist/innovatsiina-diia
USER node
CMD ["node", "dist/innovatsiina-diia/server/server.mjs"]

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend ./backend
WORKDIR /app/backend
USER node
CMD ["node", "dist/server.js"]
