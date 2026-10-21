#!/usr/bin/env bash
#
# Build a Release copy of HN Comment Sort and install it for the current user.
# No paid Apple Developer Program membership is needed for local use.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP_NAME="HN Comment Sort.app"
SCHEME="HN Comment Sort (macOS)"
DEST_DIR="${HNS_INSTALL_DIR:-$HOME/Applications}"
DEST="$DEST_DIR/$APP_NAME"
DERIVED="$ROOT/build/DerivedData"
LOG="$ROOT/build/xcodebuild.log"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister"

unregister_app() {
    local app="$1"
    local extension="$app/Contents/PlugIns/HN Comment Sort Extension.appex"

    if [[ -d "$extension" ]]; then
        pluginkit -r "$extension" >/dev/null 2>&1 || true
    fi

    if [[ -x "$LSREGISTER" && -d "$app" ]]; then
        "$LSREGISTER" -u "$app" >/dev/null 2>&1 || true
    fi
}

if ! command -v xcodebuild >/dev/null 2>&1; then
    echo "xcodebuild not found. Install Xcode from the App Store first." >&2
    exit 1
fi

mkdir -p "$ROOT/build" "$DEST_DIR"

echo "==> Stopping any running copy of $APP_NAME"
pkill -f "$APP_NAME/Contents/MacOS/HN Comment Sort" 2>/dev/null || true
sleep 1

# Drop the old registration before replacing the app, so Safari doesn't keep
# stale entries for the previous copy.
unregister_app "$DEST"

echo "==> Building $SCHEME (Release)"
if [[ -n "${DEVELOPMENT_TEAM:-}" ]]; then
    BUILD_OK=0
    xcodebuild \
        -project "HN Comment Sort.xcodeproj" \
        -scheme "$SCHEME" \
        -configuration Release \
        -derivedDataPath "$DERIVED" \
        -destination "platform=macOS" \
        DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
        build >"$LOG" 2>&1 || BUILD_OK=$?
else
    BUILD_OK=0
    xcodebuild \
        -project "HN Comment Sort.xcodeproj" \
        -scheme "$SCHEME" \
        -configuration Release \
        -derivedDataPath "$DERIVED" \
        -destination "platform=macOS" \
        build >"$LOG" 2>&1 || BUILD_OK=$?
fi

if [[ "$BUILD_OK" -ne 0 ]]; then
    echo
    echo "Build failed. Last lines from $LOG:" >&2
    tail -40 "$LOG" >&2
    echo
    echo "If this is a signing error, open the project in Xcode and choose your" >&2
    echo "team under Signing & Capabilities, or run:" >&2
    echo "  DEVELOPMENT_TEAM=YOURTEAMID ./scripts/install-local.sh" >&2
    exit "$BUILD_OK"
fi

BUILT="$DERIVED/Build/Products/Release/$APP_NAME"
if [[ ! -d "$BUILT" ]]; then
    echo "Build succeeded, but $BUILT is missing." >&2
    exit 1
fi

echo "==> Installing to $DEST"
rm -rf "$DEST"
ditto "$BUILT" "$DEST"

EXTENSION="$DEST/Contents/PlugIns/HN Comment Sort Extension.appex"
if [[ -d "$EXTENSION" ]]; then
    pluginkit -a "$EXTENSION" >/dev/null 2>&1 || true
fi

# xcodebuild registers the app it just built. Unregister that build copy so
# Safari lists only the installed app, not every temporary build.
unregister_app "$BUILT"

echo "==> Launching"
open "$DEST"

cat <<EOF

Installed: $DEST

Enable it in Safari:
  1. Click "Quit and Open Safari Extensions Preferences..." in the app window.
  2. Tick HN Comment Sort.
  3. Allow access on news.ycombinator.com.
  4. Open any Hacker News comments page.

If Safari does not list it:
  Safari > Settings > Advanced > Show features for web developers
  Develop > Allow Unsigned Extensions (must be re-enabled after Safari quits)

Uninstall: ./scripts/uninstall-local.sh
EOF
