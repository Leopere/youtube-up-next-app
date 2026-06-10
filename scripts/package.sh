#!/usr/bin/env bash
set -euo pipefail

APP_NAME="YouTube Up Next"
APP_BUNDLE_ID="ca.nixc.youtube-up-next"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/release"
VERSION="$(cd "$ROOT_DIR" && node -p "require('./package.json').version")"

ARCH="${ELECTRON_ARCH:-$(uname -m)}"
case "$ARCH" in
  arm64)
    PACKAGER_ARCH="arm64"
    ;;
  x86_64|x64)
    PACKAGER_ARCH="x64"
    ;;
  universal)
    PACKAGER_ARCH="universal"
    ;;
  *)
    echo "Unsupported Electron arch: $ARCH" >&2
    exit 1
    ;;
esac

for tool in node npx ditto codesign /usr/libexec/PlistBuddy; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing required tool: $tool" >&2
    exit 1
  fi
done

mkdir -p "$RELEASE_DIR"
rm -rf "$RELEASE_DIR/${APP_NAME}-darwin-${PACKAGER_ARCH}" "$RELEASE_DIR/${APP_NAME}.app"
rm -f "$RELEASE_DIR/YouTube-Up-Next-macOS-Electron-${PACKAGER_ARCH}.zip"

(
  cd "$ROOT_DIR"
  npx electron-packager "$ROOT_DIR" "$APP_NAME" \
    --platform=darwin \
    --arch="$PACKAGER_ARCH" \
    --out="$RELEASE_DIR" \
    --overwrite \
    --app-bundle-id="$APP_BUNDLE_ID" \
    --app-version="$VERSION" \
    --build-version="$VERSION" \
    --extend-info="$ROOT_DIR/build/mac/Info.plist" \
    --extra-resource="$ROOT_DIR/extension" \
    --ignore='^/dist($|/)' \
    --ignore='^/release($|/)' \
    --ignore='^/\.git($|/)'
)

PACKAGED_APP="$RELEASE_DIR/${APP_NAME}-darwin-${PACKAGER_ARCH}/${APP_NAME}.app"
cp "$ROOT_DIR/assets/youtube-up-next.icns" "$PACKAGED_APP/Contents/Resources/youtube-up-next.icns"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile youtube-up-next.icns" "$PACKAGED_APP/Contents/Info.plist" 2>/dev/null || \
  /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string youtube-up-next.icns" "$PACKAGED_APP/Contents/Info.plist"

codesign --force --deep --sign - "$PACKAGED_APP" >/dev/null
ditto "$PACKAGED_APP" "$RELEASE_DIR/${APP_NAME}.app"

(
  cd "$RELEASE_DIR"
  ditto -c -k --sequesterRsrc --keepParent "${APP_NAME}.app" "YouTube-Up-Next-macOS-Electron-${PACKAGER_ARCH}.zip"
)

echo "Packaged $RELEASE_DIR/${APP_NAME}.app"
echo "Packaged $RELEASE_DIR/YouTube-Up-Next-macOS-Electron-${PACKAGER_ARCH}.zip"
