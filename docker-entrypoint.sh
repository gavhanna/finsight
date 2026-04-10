#!/bin/sh
set -e

echo "Running database migrations..."
node /app/migrate.mjs

echo "Starting application..."
exec node /app/.output/server/index.mjs
