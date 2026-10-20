# El proyecto corre con Bun (Elysia + TypeScript), no con Node: la imagen es la de Bun
# en la misma versión que se usa en local (1.4).
FROM oven/bun:1.4-alpine

WORKDIR /app

# Primero solo el lockfile, para que Docker reutilice la capa de dependencias si no cambian.
# bun.lock cumple el papel de package-lock.json (equivale a `npm ci`).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["bun", "src/index.ts"]
