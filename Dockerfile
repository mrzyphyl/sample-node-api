FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bun prisma generate

COPY . .

RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
