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
health_ok=false
for attempt in {1..10}; do
  if curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3000/api/health; then
    health_ok=true
    break
  fi
  sleep 2
done
[[ "$health_ok" == true ]] || {
  echo "Deploy stopped: backend health check did not recover." >&2
  exit 1
}
echo
echo "Deploy complete: $(git rev-parse --short HEAD)"
