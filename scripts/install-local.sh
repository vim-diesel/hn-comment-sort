#!/usr/bin/env bash
#
# Build a Release copy of HN Comment Sort and install it for the current user.
# Uses the private local config; no Apple account is needed by default.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP_NAME="HN Comment Sort.app"
DEST_DIR="${HNS_INSTALL_DIR:-$HOME/Applications}"
DEST="$DEST_DIR/$APP_NAME"
DERIVED="$ROOT/build/DerivedData"
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

# Build successfully before replacing the installed app.
"$ROOT/scripts/build-local.sh"
mkdir -p "$DEST_DIR"

BUILT="$DERIVED/Build/Products/Release/$APP_NAME"
if [[ ! -d "$BUILT" ]]; then
    echo "Build succeeded, but $BUILT is missing." >&2
    exit 1
fi

echo "==> Stopping any running copy of $APP_NAME"
pkill -f "$APP_NAME/Contents/MacOS/HN Comment Sort" 2>/dev/null || true
sleep 1
unregister_app "$DEST"

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

Uninstall: make uninstall
EOF
