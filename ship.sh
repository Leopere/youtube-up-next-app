#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: ./ship.sh <commit message>" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="YouTube Up Next"
APP_PATH="/Applications/${APP_NAME}.app"
message="$*"

cd "$ROOT_DIR"

VERSION="$(node -p "require('./package.json').version")"

npm run verify

if ! grep -F "Current version: \`$VERSION\`" README.md >/dev/null; then
  echo "README.md release metadata is not synced to version $VERSION" >&2
  exit 1
fi

git add .

if git diff --cached --quiet; then
  echo "No source changes to commit; rebuilding and reinstalling local release anyway."
else
  git commit -m "$message"
  git push
fi

osascript -e "tell application \"$APP_NAME\" to quit" >/dev/null 2>&1 || true
sleep 2

"$ROOT_DIR/scripts/install.sh" "$APP_PATH"
open "$APP_PATH"
sleep 3

INSTALLED_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP_PATH/Contents/Info.plist")"
if [ "$INSTALLED_VERSION" != "$VERSION" ]; then
  echo "Installed version $INSTALLED_VERSION does not match package version $VERSION" >&2
  exit 1
fi

if ! pgrep -f "$APP_PATH/Contents/MacOS/$APP_NAME" >/dev/null; then
  echo "$APP_NAME did not relaunch from $APP_PATH" >&2
  exit 1
fi

echo "Shipped, installed, and relaunched $APP_NAME $VERSION"
