#!/usr/bin/env bash

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:3000}"

health="$(curl -fsS "$BACKEND_URL/api/healthz")"
printf '%s' "$health" | rg '"status":"ok"' >/dev/null

presets="$(curl -fsS "$BACKEND_URL/api/presets")"
printf '%s' "$presets" | rg '"id"' >/dev/null

snapshot="$(curl -fsS "$BACKEND_URL/api/session/snapshot")"
printf '%s' "$snapshot" | rg '"preset"' >/dev/null

index_html="$(curl -fsS "$FRONTEND_URL")"
printf '%s' "$index_html" | rg '<!doctype html>|<div id="root">' >/dev/null

echo "smoke test passed"
