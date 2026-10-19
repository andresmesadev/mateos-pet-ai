#!/usr/bin/env bash
# Finite read-only health observation. No application environment or Docker socket
# is passed to the observer container. Interrupted evidence is never overwritten.
set -euo pipefail
bundle_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
state_dir=/var/lib/mateos-pet-ai/stability
[[ ${MATEOS_STABILITY_IMAGE:-} =~ ^sha256:[a-f0-9]{64}$ ]] || exit 64
[[ ${MATEOS_STABILITY_VERSION:-} =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 64
[[ ${MATEOS_STABILITY_WINDOW:-} =~ ^ventana-[0-9]+\.[0-9]+\.[0-9]+-[0-9]{8}T[0-9]{6}Z$ ]] || exit 64
[[ -d "$state_dir" && ! -L "$state_dir" ]] || exit 65
[[ ! -e "$state_dir/$MATEOS_STABILITY_WINDOW.jsonl" && ! -L "$state_dir/$MATEOS_STABILITY_WINDOW.jsonl" ]] || {
  echo 'Existing window retained. Review it before selecting a new observation.' >&2
  exit 65
}
docker image inspect "$MATEOS_STABILITY_IMAGE" >/dev/null
exec docker run --rm --init --name mateos-pet-ai-stability --pull=never \
  --label com.mateos.operation=stability-window \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges:true \
  --memory=128m --cpus=0.25 --pids-limit=64 --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$bundle_dir/scripts/observe-production.cjs,dst=/workspace/scripts/observe-production.cjs,readonly" \
  --mount "type=bind,src=$state_dir,dst=/workspace/.cache/stability" \
  "$MATEOS_STABILITY_IMAGE" node /workspace/scripts/observe-production.cjs \
  --output "/workspace/.cache/stability/$MATEOS_STABILITY_WINDOW.jsonl" \
  --hours 48 --interval-seconds 300 --expected-version "$MATEOS_STABILITY_VERSION"
