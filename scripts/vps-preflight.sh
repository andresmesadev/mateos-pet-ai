#!/usr/bin/env bash
# Read-only production inspection for the queue-recovery release.
# Run from the repository root on the VPS. It never writes to the database,
# changes containers, or prints DATABASE_URL / application secrets.
set -euo pipefail

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

echo "== Host =="
date -Is
git rev-parse --show-toplevel
git status --short
git log -1 --format='commit=%H%nsubject=%s'
if command -v node >/dev/null 2>&1; then
  echo "node=$(node --version)"
else
  echo "node=not_installed_on_host"
fi
compose version

echo "== Containers =="
compose ps
backend_version=$(compose exec -T backend node -p "require('./package.json').version" </dev/null)
echo "backend_version=$backend_version"

echo "== Health (local reverse-proxy bypass) =="
curl --fail --silent --show-error --connect-timeout 5 http://127.0.0.1:3000/api/health
echo

echo "== Prisma migration status =="
compose exec -T backend sh -lc 'cd /app && npx prisma migrate status' </dev/null

echo "== Inbound queue (read-only) =="
compose exec -T backend node - <<'NODE'
const { Client } = require("pg");

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const exists = await client.query('SELECT to_regclass(\'"InboundJob"\') AS table_name');
    if (!exists.rows[0].table_name) {
      console.log(JSON.stringify({ inboundJob: "absent" }));
      return;
    }
    const columns = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'InboundJob'
    `);
    const has = new Set(columns.rows.map((row) => row.column_name));
    const phase = has.has("phase") ? 'COALESCE(phase, \'legacy\')' : "'legacy'";
    const summary = await client.query(`
      SELECT status, ${phase} AS phase, COUNT(*)::int AS count
      FROM "InboundJob"
      GROUP BY status, ${phase}
      ORDER BY status, phase
    `);
    const expired = has.has("leaseExpiresAt") ? await client.query(`
      SELECT COUNT(*)::int AS count
      FROM "InboundJob"
      WHERE status = 'claimed'
        AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= now())
    `) : { rows: [{ count: "not_available_before_2.36.1" }] };
    console.log(JSON.stringify({ inboundJob: "present", summary: summary.rows, expiredClaims: expired.rows[0].count }));
  } finally {
    await client.end().catch(() => undefined);
  }
})().catch((error) => {
  console.error(`queue inspection failed: ${error.message}`);
  process.exitCode = 1;
});
NODE

echo "== Backend worker logs (last 100 lines) =="
compose logs --tail=100 backend | grep -E 'InboundMessageJob|InboundJob|Scheduled every|needs_review' || true
