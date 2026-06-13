# YouTube Up Next

An Electron desktop app and browser extension for YouTube that adds a local Up Next queue side pane.

## What it does

- Adds `+ Next` and `+ Last` buttons on YouTube thumbnails.
- Adds a fixed side pane with queued videos.
- Lets you play, remove, clear, and reorder queued videos.
- Adds a Watch Later tab that reads your YouTube Watch Later playlist when you are signed in.
- Supports `+ Next` to put a video at the front of the queue and `+ Last` to put it at the end.
- Keeps played videos in the local queue history, greyed out, instead of deleting them.
- Automatically opens the next queued video when the current one ends.
- Opens watch pages in Theater mode.
- Adds a playback speed overlay from `0.10x` to `5.00x` in `0.10x` steps.
- Adds opt-in SponsorBlock-compatible sponsor skipping with `Sponsor`, `Quiet`, and `Aggro` modes.

The queue is local extension storage. It does not create or edit real YouTube playlists.

Played state is also stored locally. The queue count is shown as `unplayed/total`; use `Reset Played` to make greyed videos playable in queue order again.

Playback speed is stored locally and reapplied as YouTube navigates between videos.

SponsorBlock support uses the public SponsorBlock API to skip submitted segments. It does not bundle the full SponsorBlock browser extension, submit segments, or vote on segments. It is off by default. Click `SB` in the speed overlay to enable it after acknowledging that this is meant to reduce interruptions during continuous playback and that you should support creators directly when you can.

When SponsorBlock is on, the `SB` button is red. When a segment is skipped, the app shows a toast such as `Skipped sponsor` or `Skipped intro`.

Use the mode button next to `SB` to choose what gets skipped:

- `Sponsor`: skips only submitted sponsor segments.
- `Quiet`: skips sponsors, interaction reminders, intros, and outros.
- `Aggro`: skips sponsors, self-promo, interaction reminders, intros, outros, previews, and hooks.

## Where to Add Videos

- On a video or Short page, use the floating `+ Next` or `+ Last` buttons near the top-right of the window.
- On Shorts pages, use the bottom `Short + Next / + Last` dock if YouTube's overlay gets in the way.
- On YouTube browse/search/recommendation pages, use the visible `+ Next` or `+ Last` buttons on each thumbnail.
- If the side pane is open, use the `+ Next` or `+ Last` buttons at the top of the Queue tab.

## Login

The Electron app uses its own local profile:

`~/Library/Application Support/YouTube Up Next`

Sign in to YouTube inside the Electron app. This profile is separate from Chrome, Chromium, and the older Chromium wrapper profile, so existing browser sign-ins are not shared.

Google can reject sign-in inside embedded browsers on some accounts or flows. If that happens, use the browser extension path or the legacy Chromium wrapper.

## Requirements

- Node.js and npm for local Electron development and packaging
- macOS for the packaged desktop app scripts
- Chrome, Edge, Brave, or Chromium for the optional browser extension install
- Developer mode enabled for manual extension install

## Run Electron App

Install dependencies:

```sh
npm install
```

Run the desktop app:

```sh
npm start
```

## Install Electron App

Package and install the macOS Electron app to `/Applications/YouTube Up Next.app`:

```sh
./scripts/install.sh
open "/Applications/YouTube Up Next.app"
```

Install to another path:

```sh
./scripts/install.sh "$HOME/Applications/YouTube Up Next.app"
```

## Package Electron App

Create a local macOS Electron build and zip:

```sh
./scripts/package.sh
```

The generated app and zip are written to `release/`.

## Companion App

This app is separate from the YouTube Music desktop app. On this Mac, the installed YouTube Music app is the th-ch desktop app:

- Upstream: `https://github.com/th-ch/youtube-music`
- Bundle id: `com.github.th-ch.youtube-music`
- App path: `/Applications/YouTube Music.app`

Open it with:

```sh
./scripts/open-youtube-music.sh
```

## Install Extension

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome, Edge, Brave, or Chromium.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the `extension/` folder from this repository.
6. Open YouTube in that browser.

For an app-like window, create a browser app/shortcut for YouTube after loading the extension. The extension will still run in that YouTube app window because it is installed in the browser profile.

## Package Extension

Create a distributable extension zip:

```sh
./scripts/package-extension.sh
```

The zip is written to:

`dist/YouTube-Up-Next-extension.zip`

Manual extension install still requires unpacking the zip and loading the unpacked folder. Publishing to the Chrome Web Store would be the cleaner public install path.

## Legacy Chromium Wrapper

This repository still includes the older Mac wrapper installer for local fallback use. It launches YouTube with the extension preloaded in Chromium and opens the window at `1600x900` from position `80,60`.

This path requires Chromium at `/Applications/Chromium.app` and uses a separate browser profile:

`~/Library/Application Support/YouTube Up Next Chromium`

Install Chromium if needed:

```sh
brew install --cask chromium
```

Install the legacy wrapper:

```sh
./scripts/install-chromium-wrapper.sh
open "/Applications/YouTube Up Next.app"
```

The generated app and zips are build artifacts and are intentionally ignored by git.
