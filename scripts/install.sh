#!/usr/bin/env bash
set -euo pipefail

APP_NAME="YouTube Up Next"
APP_BUNDLE_ID="ca.nixc.youtube-up-next"
APP_VERSION="0.1.0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATH="${1:-/Applications/${APP_NAME}.app}"
CHROMIUM_APP="${CHROMIUM_APP:-/Applications/Chromium.app}"

if [[ ! -d "$CHROMIUM_APP" ]]; then
  echo "Chromium is required at $CHROMIUM_APP" >&2
  echo "Install it with: brew install --cask chromium" >&2
  exit 1
fi

for tool in osacompile codesign ditto /usr/libexec/PlistBuddy; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool" >&2
    exit 1
  fi
done

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
TMP_APP="$TMP_DIR/${APP_NAME}.app"

osacompile -o "$TMP_APP" "$ROOT_DIR/scripts/launch-youtube-up-next.applescript"

mkdir -p "$TMP_APP/Contents/Resources"
ditto "$ROOT_DIR/extension" "$TMP_APP/Contents/Resources/extension"
cp "$ROOT_DIR/assets/youtube-up-next.icns" "$TMP_APP/Contents/Resources/youtube-up-next.icns"

/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $APP_BUNDLE_ID" "$TMP_APP/Contents/Info.plist" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string $APP_BUNDLE_ID" "$TMP_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $APP_VERSION" "$TMP_APP/Contents/Info.plist" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string $APP_VERSION" "$TMP_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $APP_VERSION" "$TMP_APP/Contents/Info.plist" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string $APP_VERSION" "$TMP_APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile youtube-up-next.icns" "$TMP_APP/Contents/Info.plist" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string youtube-up-next.icns" "$TMP_APP/Contents/Info.plist"

codesign --force --deep --sign - "$TMP_APP" >/dev/null

mkdir -p "$(dirname "$APP_PATH")"
rm -rf "$APP_PATH"
ditto "$TMP_APP" "$APP_PATH"

if [[ "$APP_PATH" == /Applications/* ]]; then
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP_PATH" >/dev/null 2>&1 || true
fi

echo "Installed $APP_PATH"
