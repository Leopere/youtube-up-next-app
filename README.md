# YouTube Up Next App

Local Mac app wrapper for YouTube with a custom Up Next side pane.

## What it does

- Opens YouTube in a standalone Chromium app window.
- Loads the local `extension/` unpacked Chrome extension.
- Adds `+ Next` and `+ Last` buttons on YouTube thumbnails.
- Adds a fixed side pane with queued videos.
- Lets you play, remove, clear, and reorder queued videos.
- Adds a Watch Later tab that reads your YouTube Watch Later playlist when you are signed in.
- Supports `+ Next` to put a video at the front of the queue and `+ Last` to put it at the end.
- Keeps played videos in the local queue history, greyed out, instead of deleting them.
- Automatically opens the next queued video when the current one ends.
- Opens watch pages in Theater mode.
- Launches the app window at `1600x900` from position `80,60` to keep a predictable video-first 16:9 shape.
- Uses the YouTube favicon as the Mac app icon.

The queue is local extension storage. It does not create or edit real YouTube playlists.

Played state is also stored locally. The queue count is shown as `unplayed/total`; use `Reset Played` to make greyed videos playable in queue order again.

## Where to Add Videos

- On a video or Short page, use the floating `+ Next` or `+ Last` buttons near the top-right of the window.
- On Shorts pages, use the bottom `Short + Next / + Last` dock if YouTube's overlay gets in the way.
- On YouTube browse/search/recommendation pages, use the visible `+ Next` or `+ Last` buttons on each thumbnail.
- If the side pane is open, use the `+ Next` or `+ Last` buttons at the top of the Queue tab.

## Login

The app uses Chromium so the local extension can be loaded reliably. It uses a persistent profile at:

`~/Library/Application Support/YouTube Up Next Chromium`

That profile is separate from Google Chrome, so it will not inherit your Chrome login. Sign in to YouTube inside `YouTube Up Next.app` once; the app will reuse the same profile on later launches.

## Requirements

- macOS
- Chromium installed at `/Applications/Chromium.app`

Install Chromium with Homebrew if needed:

```sh
brew install --cask chromium
```

## Install

From this repository:

```sh
./scripts/install.sh
open "/Applications/YouTube Up Next.app"
```

The installer builds a self-contained app bundle at:

`/Applications/YouTube Up Next.app`

The extension is copied into:

`/Applications/YouTube Up Next.app/Contents/Resources/extension`

## Package

Create a distributable zip:

```sh
./scripts/package.sh
```

The zip is written to:

`dist/YouTube-Up-Next-macOS.zip`

The generated app and zip are build artifacts and are intentionally ignored by git.
