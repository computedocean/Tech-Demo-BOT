#!/usr/bin/env bash
# Creates server/.venv and clones Kronos (MIT, not on PyPI) at a pinned commit.
set -euo pipefail
cd "$(dirname "$0")"
KRONOS_SHA=67b630e67f6a18c9e9be918d9b4337c960db1e9a
if [ ! -d vendor/Kronos ]; then
  git clone -q https://github.com/shiyu-coder/Kronos vendor/Kronos
  git -C vendor/Kronos checkout -q "$KRONOS_SHA"
fi
[ -d .venv ] || uv venv -q .venv
uv pip install -q -p .venv -r requirements.txt --index-strategy unsafe-best-match
