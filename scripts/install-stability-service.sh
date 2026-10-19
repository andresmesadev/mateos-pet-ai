#!/usr/bin/env bash
# Install a finite observer without redeploying or restarting the application.
set -euo pipefail
[[ $# -eq 3 ]] || { echo 'Usage: install-stability-service.sh sha256:IMAGE VERSION ventana-VERSION-YYYYMMDDTHHMMSSZ' >&2; exit 64; }
image=$1
version=$2
window=$3
[[ "$image" =~ ^sha256:[a-f0-9]{64}$ && "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 64
[[ "$window" =~ ^ventana-[0-9]+\.[0-9]+\.[0-9]+-[0-9]{8}T[0-9]{6}Z$ && "$window" == "ventana-$version-"* ]] || exit 64
bundle_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
state_dir=/var/lib/mateos-pet-ai/stability
if systemctl is-active --quiet mateos-pet-ai-stability.service; then
  echo 'An observation is active; refusing to replace it.' >&2
  exit 65
fi
[[ ! -L "$state_dir" && ! -e "$state_dir/$window.jsonl" && ! -L "$state_dir/$window.jsonl" ]] || exit 65
[[ -z $(docker ps -aq --filter 'name=^/mateos-pet-ai-stability$') ]] || { echo 'Observer container already exists.' >&2; exit 65; }
docker image inspect "$image" >/dev/null
bash -n "$bundle_dir/scripts/run-stability-window.sh"
sudo install -d -m 755 /opt/mateos-pet-ai-observer/scripts /etc/mateos-pet-ai
sudo install -d -m 700 -o ubuntu -g ubuntu "$state_dir"
sudo install -m 644 "$bundle_dir/scripts/observe-production.cjs" /opt/mateos-pet-ai-observer/scripts/
sudo install -m 755 "$bundle_dir/scripts/run-stability-window.sh" /opt/mateos-pet-ai-observer/scripts/
config_tmp=$(mktemp)
trap 'rm -f "$config_tmp"' EXIT
printf 'MATEOS_STABILITY_IMAGE=%s\nMATEOS_STABILITY_VERSION=%s\nMATEOS_STABILITY_WINDOW=%s\n' "$image" "$version" "$window" > "$config_tmp"
sudo install -m 644 "$config_tmp" /etc/mateos-pet-ai/stability.conf
sudo install -m 644 "$bundle_dir/deploy/systemd/mateos-pet-ai-stability.service" /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/mateos-pet-ai-stability.service
sudo systemctl daemon-reload
sudo systemctl start mateos-pet-ai-stability.service
systemctl show mateos-pet-ai-stability.service --property=ActiveState,SubState,Result,ExecMainStartTimestamp
