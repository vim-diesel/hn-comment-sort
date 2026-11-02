#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG="$ROOT/config/local.xcconfig"
if [[ ! -f "$CONFIG" ]]; then
    cp "$ROOT/config/local.example.xcconfig" "$CONFIG"
    echo "Created private config: $CONFIG"
fi
