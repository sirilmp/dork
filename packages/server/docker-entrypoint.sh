#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] Running seed script (idempotent)..."
npx tsx prisma/seed.ts || echo "[entrypoint] Seed script failed or was skipped; continuing."

echo "[entrypoint] Starting server..."
exec "$@"
