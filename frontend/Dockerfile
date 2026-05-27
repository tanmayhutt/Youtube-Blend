FROM node:18-alpine AS build

WORKDIR /app

COPY package.json ./
COPY bun.lockb ./
RUN npm install

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
