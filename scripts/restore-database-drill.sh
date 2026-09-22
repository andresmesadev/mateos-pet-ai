#!/usr/bin/env bash
# Restores one encrypted backup into an isolated, disposable PostgreSQL
# container. It never connects to or modifies the production database.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 /absolute/path/to/backup-set /absolute/path/to/age-identity" >&2
  exit 64
fi

backup_set=$1
identity_file=$2
pg_image=${MATEOS_BACKUP_PG_IMAGE:-postgres:18-alpine}
keep_container=${MATEOS_RESTORE_KEEP_CONTAINER:-false}

fail() {
  echo "restore drill failed: $*" >&2
  exit 1
}

[[ "$backup_set" = /* && -d "$backup_set" ]] || fail "backup set must be an existing absolute directory"
[[ "$identity_file" = /* && -f "$identity_file" ]] || fail "age identity must be an existing absolute file"
[[ -f "$backup_set/database.dump.age" && -f "$backup_set/SHA256SUMS" ]] || fail "backup set is incomplete"
command -v age >/dev/null 2>&1 || fail "age is not installed"
command -v docker >/dev/null 2>&1 || fail "docker is not installed"

(
  cd "$backup_set"
  sha256sum --check --strict SHA256SUMS
)

container="mateos-restore-drill-$(date -u +%Y%m%d%H%M%S)-$$"
cleanup() {
  if [[ "$keep_container" != "true" ]]; then
    docker rm -f "$container" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

docker run -d --name "$container" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$pg_image" >/dev/null

ready_checks=0
for _ in $(seq 1 60); do
  if docker exec "$container" psql -U postgres -d postgres -Atc "SELECT 1" >/dev/null 2>&1; then
    ready_checks=$((ready_checks + 1))
    if (( ready_checks >= 3 )); then
      break
    fi
  else
    ready_checks=0
  fi
  sleep 1
done
(( ready_checks >= 3 )) || fail "temporary PostgreSQL did not become ready"
docker exec "$container" createdb -U postgres mateos_restore_drill

age --decrypt -i "$identity_file" "$backup_set/database.dump.age" | \
  docker exec -i "$container" pg_restore \
    --username=postgres \
    --dbname=mateos_restore_drill \
    --no-owner \
    --no-acl \
    --exit-on-error

table_count=$(docker exec "$container" psql -U postgres -d mateos_restore_drill -Atc \
  "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';")
[[ "$table_count" =~ ^[0-9]+$ && "$table_count" -gt 0 ]] || fail "restored database has no public tables"
migration_table_count=$(docker exec "$container" psql -U postgres -d mateos_restore_drill -Atc \
  "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = '_prisma_migrations';")
[[ "$migration_table_count" = "1" ]] || fail "restored database has no Prisma migration history"
migration_count=$(docker exec "$container" psql -U postgres -d mateos_restore_drill -Atc \
  'SELECT count(*) FROM "_prisma_migrations";')
[[ "$migration_count" =~ ^[0-9]+$ && "$migration_count" -gt 0 ]] || fail "restored database has no applied migrations"
echo "restore drill passed: tables=$table_count migrations=$migration_count"
