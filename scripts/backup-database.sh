#!/usr/bin/env bash
# Creates an encrypted PostgreSQL backup without writing credentials or the
# unencrypted dump outside a private staging directory.
set -euo pipefail

repo_dir=${MATEOS_REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}
backup_dir=${MATEOS_BACKUP_DIR:-/var/backups/mateos-pet-ai}
recipient_file=${MATEOS_BACKUP_RECIPIENT_FILE:-/etc/mateos-pet-ai/backup-recipient.pub}
retention_days=${MATEOS_BACKUP_RETENTION_DAYS:-14}
pg_image=${MATEOS_BACKUP_PG_IMAGE:-postgres:18-alpine}
not_before=${MATEOS_BACKUP_NOT_BEFORE:-}
provided_service_file=${MATEOS_BACKUP_PG_SERVICE_FILE:-}
docker_network=${MATEOS_BACKUP_DOCKER_NETWORK:-}

fail() {
  echo "backup failed: $*" >&2
  exit 1
}

[[ "$backup_dir" = /* && "$backup_dir" != "/" ]] || fail "backup directory must be an absolute path other than /"
[[ "$retention_days" =~ ^[0-9]+$ ]] || fail "retention must be a whole number of days"
[[ -d "$backup_dir" && -w "$backup_dir" ]] || fail "backup directory is missing or not writable: $backup_dir"
[[ -f "$recipient_file" ]] || fail "age recipient file is missing: $recipient_file"
command -v age >/dev/null 2>&1 || fail "age is not installed"
command -v docker >/dev/null 2>&1 || fail "docker is not installed"

if [[ -n "$not_before" ]]; then
  not_before_epoch=$(date -u -d "$not_before" +%s) || fail "invalid MATEOS_BACKUP_NOT_BEFORE value"
  if (( $(date -u +%s) < not_before_epoch )); then
    echo "backup skipped until $not_before"
    exit 0
  fi
fi

umask 077
exec 9>"$backup_dir/.backup.lock"
flock -n 9 || fail "another backup is already running"

stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_name="mateos-pet-ai-$stamp"
final_dir="$backup_dir/$backup_name"
staging_dir=$(mktemp -d "$backup_dir/.${backup_name}.tmp.XXXXXX")
service_file="$staging_dir/pg_service.conf"
dump_file="$staging_dir/database.dump"
encrypted_file="$staging_dir/database.dump.age"

cleanup() {
  rm -rf -- "$staging_dir"
}
trap cleanup EXIT

if [[ -n "$provided_service_file" ]]; then
  [[ -f "$provided_service_file" ]] || fail "provided PostgreSQL service file does not exist"
  cp "$provided_service_file" "$service_file"
else
  [[ -f "$repo_dir/docker-compose.yml" ]] || fail "repository not found: $repo_dir"
  (
    cd "$repo_dir"
    docker compose exec -T backend node <<'NODE'
const value = process.env.DATABASE_URL;
if (!value) throw new Error("DATABASE_URL is unavailable in the backend container");
const url = new URL(value);
if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
  throw new Error("DATABASE_URL is not PostgreSQL");
}
const serviceValue = (input) => String(input).replace(/\\/g, "\\\\");
const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
const values = {
  host: url.hostname,
  port: url.port || "5432",
  dbname: database,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  sslmode: url.searchParams.get("sslmode") || "require",
};
for (const [key, item] of Object.entries(values)) {
  if (!item || /[\r\n]/.test(item)) throw new Error(`invalid ${key} in DATABASE_URL`);
}
process.stdout.write(`[mateos]\n${Object.entries(values).map(([key, item]) => `${key}=${serviceValue(item)}`).join("\n")}\n`);
NODE
  ) > "$service_file"
fi
chmod 600 "$service_file"

docker_args=(run --rm --user "$(id -u):$(id -g)" -e PGSERVICEFILE=/run/secrets/pg_service.conf)
if [[ -n "$docker_network" ]]; then
  docker_args+=(--network "$docker_network")
fi
docker_args+=(-v "$service_file:/run/secrets/pg_service.conf:ro" -v "$staging_dir:/backup" "$pg_image")

docker "${docker_args[@]}" pg_dump \
  --dbname=service=mateos \
  --format=custom \
  --compress=zstd:9 \
  --no-owner \
  --no-acl \
  --file=/backup/database.dump

docker "${docker_args[@]}" pg_restore --list /backup/database.dump >/dev/null
age --encrypt -R "$recipient_file" --output "$encrypted_file" "$dump_file"
rm -f -- "$dump_file" "$service_file"

(
  cd "$staging_dir"
  sha256sum database.dump.age > SHA256SUMS
)
encrypted_sha=$(cut -d ' ' -f 1 "$staging_dir/SHA256SUMS")
encrypted_size=$(stat -c %s "$encrypted_file")
cat > "$staging_dir/manifest.txt" <<EOF
created_at_utc=$stamp
format=postgresql-custom-dump
encryption=age
encrypted_file=database.dump.age
encrypted_sha256=$encrypted_sha
encrypted_size_bytes=$encrypted_size
postgres_image=$pg_image
retention_days=$retention_days
EOF

[[ ! -e "$final_dir" ]] || fail "backup destination already exists"
chmod 600 "$staging_dir/database.dump.age" "$staging_dir/SHA256SUMS" "$staging_dir/manifest.txt"
mv "$staging_dir" "$final_dir"
trap - EXIT

find "$backup_dir" -mindepth 1 -maxdepth 1 -type d \
  -name 'mateos-pet-ai-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z' \
  -mmin "+$((retention_days * 1440))" -print -exec rm -rf -- {} +

echo "encrypted backup created: $final_dir"
