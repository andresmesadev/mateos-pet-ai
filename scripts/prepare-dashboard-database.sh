#!/usr/bin/env bash
# Prepares a separate empty operational database. Never clears the source.
# Run only for an authorized single-establishment clean start.
set -euo pipefail
[[ $# -eq 1 && "$1" =~ ^mateos_dashboard_[0-9]{8}(_[0-9]{6})?$ ]] || {
  echo 'Usage: prepare-dashboard-database.sh mateos_dashboard_YYYYMMDD[_HHMMSS]' >&2; exit 64;
}
target_db=$1
source_db=mateos
repo_dir=${MATEOS_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
cd "$repo_dir"
[[ -f docker-compose.yml ]] || exit 65
db() { docker compose exec -T db "$@"; }
active_db=$(docker compose exec -T backend node -e 'process.stdout.write(new URL(process.env.DATABASE_URL).pathname.slice(1))')
[[ "$active_db" = "$source_db" ]] || { echo 'Source differs from the active database; stop and review.' >&2; exit 65; }
[[ $(db psql -U mateos -d "$source_db" -Atc 'SELECT count(*) FROM "Tenant";') = 1 ]] || exit 65
[[ $(db psql -U mateos -d postgres -Atc "SELECT count(*) FROM pg_database WHERE datname = '$target_db';") = 0 ]] || {
  echo 'Destination exists; nothing overwritten.' >&2; exit 65;
}
created=false
completed=false
cleanup() {
  local status=$?
  if [[ "$created" = true && "$completed" = false ]]; then
    # Only this invocation's newly created, never-activated database is removed.
    db dropdb -U mateos --if-exists "$target_db" || status=1
  fi
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT
db createdb -U mateos --template=template0 "$target_db"
created=true
db pg_dump -U mateos -d "$source_db" --schema-only --no-owner --no-acl | \
  db psql -U mateos -d "$target_db" -q --single-transaction --set=ON_ERROR_STOP=1

# Technical history + reviewed business settings, never operational history.
# Services and staff (including sample credentials) deliberately stay empty.
db pg_dump -U mateos -d "$source_db" --data-only --no-owner --no-acl \
  '--table=public._prisma_migrations' '--table=public."Tenant"' \
  '--table=public."EventType"' '--table=public."ServiceCategory"' \
  '--table=public."DigitalEmployee"' | \
  db psql -U mateos -d "$target_db" -q --single-transaction --set=ON_ERROR_STOP=1

db psql -U mateos -d "$target_db" -q --set=ON_ERROR_STOP=1 <<'SQL'
BEGIN;
UPDATE "DigitalEmployee" SET status = 'pausado'
WHERE specialization IN ('recepcionista','coordinador_agenda');
DO $$
DECLARE r record; n bigint;
BEGIN
  IF (SELECT count(*) FROM "Tenant") <> 1 THEN RAISE EXCEPTION 'Expected exactly one establishment'; END IF;
  IF (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) <> 52
    OR (SELECT count(*) FROM "_prisma_migrations") <> 52 THEN RAISE EXCEPTION 'Expected 52 completed migrations'; END IF;
  IF (SELECT count(*) FROM pg_tables WHERE schemaname='public') <> 69 THEN RAISE EXCEPTION 'Expected 69 tables'; END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
    WHERE n.nspname='public' AND c.contype IN ('f','c') AND NOT c.convalidated)
    THEN RAISE EXCEPTION 'Unvalidated constraints'; END IF;
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND tablename NOT IN ('_prisma_migrations','Tenant','EventType','ServiceCategory','DigitalEmployee') LOOP
    EXECUTE format('SELECT count(*) FROM %I', r.tablename) INTO n;
    IF n <> 0 THEN RAISE EXCEPTION 'Unexpected operational rows in %',r.tablename; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM "DigitalEmployee" WHERE specialization IN ('recepcionista','coordinador_agenda') AND status <> 'pausado')
    THEN RAISE EXCEPTION 'WhatsApp employees must remain paused'; END IF;
END $$;
COMMIT;
SELECT 'prepared=' || current_database() || ' tables=69 migrations=52 operational_rows=0 services=0 staff=0 credentials=0 channels=0';
SQL
completed=true
echo 'New database prepared; application still uses the unchanged source database.'
