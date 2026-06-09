#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
APP_PATH="$DIST_DIR/YouTube Up Next.app"
ZIP_PATH="$DIST_DIR/YouTube-Up-Next-macOS.zip"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

"$ROOT_DIR/scripts/install.sh" "$APP_PATH"

(
  cd "$DIST_DIR"
  ditto -c -k --sequesterRsrc --keepParent "YouTube Up Next.app" "$ZIP_PATH"
)

echo "Packaged $ZIP_PATH"
