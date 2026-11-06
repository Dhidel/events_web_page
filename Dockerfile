FROM oven/bun:1.4.0 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY client/package.json client/bun.lock ./client/
WORKDIR /app/client
RUN bun install --frozen-lockfile

WORKDIR /app
COPY . .
RUN bun run --cwd client build

FROM oven/bun:1.4.0 AS production

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY src ./src
COPY --from=build /app/client/src/data/paginas.ts ./client/src/data/paginas.ts
COPY --from=build /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["bun", "run", "start"]
