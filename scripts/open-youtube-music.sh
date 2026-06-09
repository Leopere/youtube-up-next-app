#!/usr/bin/env bash
set -euo pipefail

BUNDLE_ID="com.github.th-ch.youtube-music"
APP_PATH="/Applications/YouTube Music.app"

if open -b "$BUNDLE_ID" 2>/dev/null; then
  exit 0
fi

if [[ -d "$APP_PATH" ]]; then
  open "$APP_PATH"
  exit 0
fi

echo "YouTube Music app was not found." >&2
echo "Expected bundle id: $BUNDLE_ID" >&2
echo "Expected path: $APP_PATH" >&2
exit 1
