#!/usr/bin/env bash
# Run the Prisma CLI in a disposable container on the Compose network.
# The production backend image intentionally does not contain the CLI.
set -euo pipefail

operation=${1:-}
case "$operation" in
  status|deploy) ;;
  *) echo "Usage: $0 status|deploy" >&2; exit 2 ;;
esac

repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"
docker compose run --rm --no-deps \
  --volume "$repo_dir:/repo:ro" \
  --entrypoint sh backend -ec '
    mkdir -p /tmp/prisma-work
    cp /repo/package.json /repo/package-lock.json /repo/prisma.config.ts /tmp/prisma-work/
    cp -R /repo/prisma /tmp/prisma-work/prisma
    cd /tmp/prisma-work
    npm ci --include=dev --no-audit --no-fund
    ./node_modules/.bin/prisma migrate "$1"
  ' sh "$operation"
