#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! xcodebuild -version >/dev/null 2>&1; then
    echo "Install the full Xcode app from the App Store first; Command Line Tools alone cannot build Safari extensions." >&2
    echo "If Xcode is installed, select it with: sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer" >&2
    exit 1
fi

"$ROOT/scripts/setup-local.sh"
mkdir -p "$ROOT/build"
LOG="$ROOT/build/xcodebuild.log"
echo "==> Building HN Comment Sort (Release)"
if ! xcodebuild \
    -project "HN Comment Sort.xcodeproj" \
    -scheme "HN Comment Sort (macOS)" \
    -configuration Release \
    -derivedDataPath "$ROOT/build/DerivedData" \
    -destination "platform=macOS" \
    -xcconfig "$ROOT/config/local.xcconfig" \
    build >"$LOG" 2>&1; then
    tail -40 "$LOG" >&2
    echo "Build failed. Full log: $LOG" >&2
    echo "Your private signing settings are in config/local.xcconfig." >&2
    exit 1
fi

echo "Built: $ROOT/build/DerivedData/Build/Products/Release/HN Comment Sort.app"
