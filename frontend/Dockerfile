FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json ./
COPY bun.lockb ./
RUN bun install

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN bun run build

FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
RUN bun install --production

COPY --from=build /app/dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "server.js"]
