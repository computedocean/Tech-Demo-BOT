#!/usr/bin/env bash
# One command: sets up the Python helper (first run), starts it on :8000, then the web app on :5173.
set -euo pipefail
cd "$(dirname "$0")"
./server/setup.sh
[ -d node_modules ] || bun install
(cd server && .venv/bin/uvicorn app:app --host 127.0.0.1 --port 8000) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
bun run dev
