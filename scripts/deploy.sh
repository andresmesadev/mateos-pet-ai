#!/bin/bash
set -euo pipefail

echo "🐾 Deploying Mateos Pet AI..."
git pull origin main
npm ci
npx prisma migrate deploy
docker-compose up -d --build
echo "✅ Deploy completado"
