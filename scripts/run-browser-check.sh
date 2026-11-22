#!/usr/bin/env bash
set -euo pipefail

output=${1:-visual-check}
if [ "$#" -gt 0 ]; then
  shift
fi
mkdir -p "$output"
preview() {
  node node_modules/vite/bin/vite.js preview --outDir "$1" --host 127.0.0.1 --port "$2" --strictPort
}
preview dist-e2e 4173 >"$output/preview-e2e.log" 2>&1 &
e2e_pid=$!
preview dist 4174 >"$output/preview-production.log" 2>&1 &
production_pid=$!
trap 'kill "$e2e_pid" "$production_pid" 2>/dev/null || true' EXIT

for port in 4173 4174; do
  for attempt in {1..60}; do
    if curl --noproxy '*' --fail --silent --max-time 2 "http://127.0.0.1:$port/" >/dev/null; then
      break
    fi
    sleep 1
  done
  curl --noproxy '*' --fail --silent --show-error "http://127.0.0.1:$port/" >/dev/null
done
npm run e2e -- --out "$output" "$@"
