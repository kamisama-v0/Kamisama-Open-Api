# ---------- Build stage ----------
FROM oven/bun AS build

RUN apt-get update && apt-get install -y build-essential python3 pkg-config openssl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY . .

ENV NODE_ENV=production
# Dummy saja: `prisma generate` tidak konek DB, tapi prisma.config.ts
# membaca env('DIRECT_URL') sehingga variabelnya harus ada saat build.
ENV DIRECT_URL=postgresql://build:build@localhost:5432/postgres

RUN bun x prisma generate
RUN bun run build

# ---------- Runtime stage ----------
FROM oven/bun:slim

# openssl dibutuhkan schema-engine saat `prisma migrate deploy`
RUN apt-get update && apt-get install -y openssl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/server ./server
COPY --from=build /app/start.sh ./start.sh
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src/templates ./src/templates

# Folder upload dibaca staticPlugin & ditulis UploadService saat runtime.
# (Free tier: ephemeral — hilang tiap restart/redeploy.)
RUN mkdir -p /app/uploads/images

ENV NODE_ENV=production

# Render inject $PORT (kode pakai process.env.PORT ?? 3000).
# Health Check Path di dashboard isi: /health
CMD ["./start.sh"]
