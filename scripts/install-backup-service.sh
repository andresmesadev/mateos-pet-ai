#!/usr/bin/env bash
# Installs the backup timer on the production VPS. The recipient is a public
# key; the matching private identity must never be copied to the server.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /absolute/path/to/ssh-public-key" >&2
  exit 64
fi

recipient_source=$1
repo_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
backup_dir=/var/backups/mateos-pet-ai
config_dir=/etc/mateos-pet-ai

[[ "$recipient_source" = /* && -f "$recipient_source" ]] || {
  echo "Public recipient must be an existing absolute file" >&2
  exit 64
}
grep -Eq '^ssh-(rsa|ed25519) ' "$recipient_source" || {
  echo "Recipient must contain an OpenSSH RSA or Ed25519 public key" >&2
  exit 65
}
command -v age >/dev/null 2>&1 || {
  echo "age must be installed before running this installer" >&2
  exit 69
}
docker image inspect postgres:18-alpine >/dev/null 2>&1 || {
  echo "postgres:18-alpine must be pulled before running this installer" >&2
  exit 69
}

sudo install -d -m 700 -o ubuntu -g ubuntu "$backup_dir"
sudo install -d -m 755 -o root -g root "$config_dir"
sudo install -m 644 -o root -g root "$recipient_source" "$config_dir/backup-recipient.pub"

config_tmp=$(mktemp)
trap 'rm -f "$config_tmp"' EXIT
cat > "$config_tmp" <<'EOF'
MATEOS_REPO_DIR=/home/ubuntu/mateos-pet-ai
MATEOS_BACKUP_DIR=/var/backups/mateos-pet-ai
MATEOS_BACKUP_RECIPIENT_FILE=/etc/mateos-pet-ai/backup-recipient.pub
MATEOS_BACKUP_RETENTION_DAYS=14
MATEOS_BACKUP_PG_IMAGE=postgres:18-alpine
MATEOS_BACKUP_NOT_BEFORE=2026-10-01T00:00:00Z
EOF
sudo install -m 644 -o root -g root "$config_tmp" "$config_dir/backup.conf"

sudo install -m 644 "$repo_dir/deploy/systemd/mateos-pet-ai-backup.service" /etc/systemd/system/
sudo install -m 644 "$repo_dir/deploy/systemd/mateos-pet-ai-backup.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mateos-pet-ai-backup.timer
sudo systemctl list-timers mateos-pet-ai-backup.timer --no-pager
