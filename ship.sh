#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: ./ship.sh <commit message>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="YouTube Up Next"
APP_PATH="/Applications/${APP_NAME}.app"
APP_PROCESS_PATTERN="$APP_PATH/Contents/MacOS/$APP_NAME"
message="$*"

cd "$ROOT_DIR"

VERSION="$(node -p "require('./package.json').version")"
TAG="v$VERSION"
PACKAGER_ARCH="${ELECTRON_ARCH:-$(uname -m)}"
case "$PACKAGER_ARCH" in
  x86_64)
    PACKAGER_ARCH="x64"
    ;;
esac
MAC_ZIP="$ROOT_DIR/release/YouTube-Up-Next-macOS-Electron-${PACKAGER_ARCH}.zip"
EXTENSION_ZIP="$ROOT_DIR/dist/YouTube-Up-Next-extension.zip"
RELEASE_NOTES="$(mktemp)"
trap 'rm -f "$RELEASE_NOTES"' EXIT

stop_running_app() {
  osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 || true

  for _attempt in {1..10}; do
    if ! pgrep -f "$APP_PROCESS_PATTERN" >/dev/null; then
      return
    fi
    sleep 1
  done

  pkill -f "$APP_PROCESS_PATTERN" >/dev/null 2>&1 || true

  for _attempt in {1..5}; do
    if ! pgrep -f "$APP_PROCESS_PATTERN" >/dev/null; then
      return
    fi
    sleep 1
  done

  echo "$APP_NAME is still running and could not be stopped" >&2
  exit 1
}

npm run verify

if ! grep -F "Current version: \`$VERSION\`" README.md >/dev/null; then
  echo "README.md release metadata is not synced to version $VERSION" >&2
  exit 1
fi

if ! grep -F "https://github.com/Leopere/youtube-up-next-app/releases/latest" README.md >/dev/null; then
  echo "README.md is missing latest release links" >&2
  exit 1
fi

git add .

if git diff --cached --quiet; then
  echo "No source changes to commit; rebuilding and reinstalling local release anyway."
else
  git commit -m "$message"
  git push
fi

git tag -f "$TAG" "$(git rev-parse HEAD)"
git push --force origin "$TAG"

stop_running_app

"$ROOT_DIR/scripts/install.sh" "$APP_PATH"

if [ ! -f "$MAC_ZIP" ]; then
  echo "Missing macOS release zip: $MAC_ZIP" >&2
  exit 1
fi

if [ ! -f "$EXTENSION_ZIP" ]; then
  echo "Missing extension release zip: $EXTENSION_ZIP" >&2
  exit 1
fi

cat >"$RELEASE_NOTES" <<EOF
YouTube Up Next $VERSION

Downloads:
- macOS app: YouTube-Up-Next-macOS-Electron-${PACKAGER_ARCH}.zip
- Browser extension: YouTube-Up-Next-extension.zip

Install the macOS app by unzipping the app archive and moving the app to /Applications.
Install the browser extension manually from the unpacked extension folder.
EOF

if command -v gh >/dev/null 2>&1; then
  if gh release view "$TAG" >/dev/null 2>&1; then
    gh release edit "$TAG" \
      --title "$APP_NAME $VERSION" \
      --target "$(git rev-parse HEAD)" \
      --notes-file "$RELEASE_NOTES" \
      --latest
    gh release upload "$TAG" "$MAC_ZIP" "$EXTENSION_ZIP" --clobber
  else
    gh release create "$TAG" "$MAC_ZIP" "$EXTENSION_ZIP" \
      --target "$(git rev-parse HEAD)" \
      --title "$APP_NAME $VERSION" \
      --notes-file "$RELEASE_NOTES" \
      --latest
  fi
else
  echo "Missing gh; cannot publish GitHub release" >&2
  exit 1
fi

open "$APP_PATH"
sleep 3

INSTALLED_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_PATH/Contents/Info.plist")"
if [ "$INSTALLED_VERSION" != "$VERSION" ]; then
  echo "Installed version $INSTALLED_VERSION does not match package version $VERSION" >&2
  exit 1
fi

RUNNING_PID="$(pgrep -f "$APP_PROCESS_PATTERN" | head -n 1 || true)"
if [ -z "$RUNNING_PID" ]; then
  echo "$APP_NAME did not relaunch from $APP_PATH" >&2
  exit 1
fi

echo "Shipped, installed, and relaunched $APP_NAME $VERSION as PID $RUNNING_PID"
