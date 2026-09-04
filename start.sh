#!/bin/sh
# Start command untuk Render: migrate dulu (idempoten), baru jalanin server.
# Butuh DIRECT_URL (direct 5432) tersedia sebagai env di dashboard Render.
set -e

echo "→ prisma migrate deploy"
bun x prisma migrate deploy

echo "→ starting server"
exec ./server
