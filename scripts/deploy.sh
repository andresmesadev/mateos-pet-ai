#!/bin/bash
set -euo pipefail

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"

[[ -z "$(git status --porcelain)" ]] || {
  echo "Deploy stopped: the VPS checkout has local changes." >&2
  exit 1
}

echo "Deploying Mateos Pet AI from origin/main..."
git pull --ff-only origin main
docker compose build backend frontend
docker compose up -d db
bash "$repo_dir/scripts/prisma-vps.sh" deploy
docker compose up -d --no-deps backend frontend
curl --fail --silent --show-error --retry 5 --retry-delay 2 \
  --retry-connrefused --max-time 15 http://127.0.0.1:3000/api/health
echo
echo "Deploy complete: $(git rev-parse --short HEAD)"
