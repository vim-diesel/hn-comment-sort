#!/usr/bin/env bash
#
# Remove the locally installed copy of HN Comment Sort.
set -euo pipefail

APP_NAME="HN Comment Sort.app"
DEST="${HNS_INSTALL_DIR:-$HOME/Applications}/$APP_NAME"

pkill -f "$APP_NAME/Contents/MacOS/HN Comment Sort" 2>/dev/null || true
sleep 1

if [[ -d "$DEST" ]]; then
    pluginkit -r "$DEST/Contents/PlugIns/HN Comment Sort Extension.appex" >/dev/null 2>&1 || true
    rm -rf "$DEST"
    echo "Removed $DEST"
else
    echo "Nothing installed at $DEST"
fi

echo "You can also remove or disable the extension in Safari > Settings > Extensions."
