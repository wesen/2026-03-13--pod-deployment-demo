#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION="${SESSION_NAME:-scenario-dev}"
SERVER_ADDR="${SERVER_ADDR:-:3001}"
UI_PORT="${UI_PORT:-3000}"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "tmux session '$SESSION' already exists"
  echo "attach with: tmux attach -t $SESSION"
  exit 0
fi

tmux new-session -d -s "$SESSION" -c "$ROOT" "ADDR=$SERVER_ADDR go run ./cmd/scenario-demo"
tmux new-window -t "$SESSION" -c "$ROOT/ui" "pnpm dev --host 0.0.0.0 --port $UI_PORT"
tmux select-window -t "$SESSION:0"

echo "started tmux session '$SESSION'"
echo "server window: ADDR=$SERVER_ADDR go run ./cmd/scenario-demo"
echo "ui window: pnpm dev --host 0.0.0.0 --port $UI_PORT"
echo "attach with: tmux attach -t $SESSION"
