#!/usr/bin/env bash
# Creates a private, data-containing snapshot before the queue-recovery
# migration. Run only on the VPS from the repository root, after preflight.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/private/backup-directory" >&2
  exit 64
fi

backup_dir=$1
if [[ "$backup_dir" != /* ]]; then
  echo "Backup directory must be an absolute path" >&2
  exit 64
fi
if [[ ! -d "$backup_dir" || ! -w "$backup_dir" ]]; then
  echo "Backup directory must exist and be writable" >&2
  exit 64
fi

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="$backup_dir/inbound-job-pre-2.36.1-$stamp.json"
if [[ -e "$target" ]]; then
  echo "Refusing to overwrite existing backup: $target" >&2
  exit 73
fi

compose exec -T backend node - <<'NODE' > "$target"
const { Client } = require("pg");

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const migrationRows = await client.query(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    ORDER BY started_at ASC
  `);
  const table = await client.query("SELECT to_regclass('public.\\\"InboundJob\\\"') AS table_name");
  const inboundJobs = table.rows[0].table_name
    ? await client.query('SELECT * FROM "InboundJob" ORDER BY "createdAt" ASC, id ASC')
    : { rows: [] };
  process.stdout.write(JSON.stringify({
    createdAt: new Date().toISOString(),
    migrationRows: migrationRows.rows,
    inboundJobs: inboundJobs.rows,
  }));
  await client.end();
})().catch((error) => {
  console.error(`backup failed: ${error.message}`);
  process.exitCode = 1;
});
NODE

chmod 600 "$target"
echo "Backup created: $target"
