# TubeTV

An Electron desktop app for YouTube that adds a local Up Next queue side pane, speed controls, SponsorBlock-compatible skipping, and a retro TV display mode.

## What it does

- Adds `+ Next` and `+ Last` buttons on YouTube thumbnails.
- Adds a fixed side pane with queued videos.
- Lets you play, remove, clear, and reorder queued videos.
- Adds a Watch Later tab that reads your YouTube Watch Later playlist when you are signed in.
- Plays Watch Later forward from the selected item in the displayed newest-to-oldest playlist order.
- Supports `+ Next` to put a video at the front of the queue and `+ Last` to put it at the end.
- Keeps played videos in the local queue history, greyed out, instead of deleting them.
- Automatically opens the next queued video when the current one ends.
- Reopens to the last YouTube page and resumes the saved video timestamp from close.
- Opens watch pages in Theater mode.
- Adds a playback speed overlay from `0.10x` to `5.00x` in `0.10x` steps.
- Press `Command+1` through `Command+5` to set playback speed directly from `1.00x` through `5.00x`.
- Adds opt-in SponsorBlock-compatible sponsor skipping with `Sponsor`, `Quiet`, and `Aggro` modes.
- Blocks YouTube Playables and removes Playables links and shelves.
- Keeps Shorts on the dedicated Shorts page while hiding Shorts shelves and cards from regular feeds.
- Keeps the existing thumbnail `+ Next` and `+ Last` actions visible with larger click targets.
- When focus isn't in a text field, press `R` to switch to a random retro TV filter, including green phosphor, black and white, red, amber, tube TV, and normal.
- When focus isn't in a text field, press `[` or `]` to change playback speed by `0.10x`. Press `\` to reset it to `1.00x`.
- Close or minimize the window to hide TubeTV in the macOS menu bar. Use the menu-bar icon to show, hide, or quit the app.
- Shrink the app window to `640x400` for compact playback.

The queue is local extension storage. It does not create or edit real YouTube playlists.

Played state is also stored locally. The queue count is shown as `unplayed/total`; use `Reset Played` to make greyed videos playable in queue order again.

Playback speed is stored locally and reapplied as YouTube navigates between videos.

SponsorBlock support uses the public SponsorBlock API to skip submitted segments. It does not bundle the full SponsorBlock extension, submit segments, or vote on segments. It is off by default. Click `SB` in the speed overlay to enable it after acknowledging that this is meant to reduce interruptions during continuous playback and that you should support creators directly when you can.

When SponsorBlock is on, the `SB` button is red. When a segment is skipped, the app shows a toast such as `Skipped sponsor` or `Skipped intro`.

Use the mode button next to `SB` to choose what gets skipped:

- `Sponsor`: skips only submitted sponsor segments.
- `Quiet`: skips sponsors, interaction reminders, intros, and outros.
- `Aggro`: skips sponsors, self-promo, interaction reminders, intros, outros, previews, and hooks.

## Release

- Current version: `0.7.0`
- Last shipped: `2026-10-13`
- Latest release: https://github.com/Leopere/youtube-up-next-app/releases/latest
- macOS app zip: https://github.com/Leopere/youtube-up-next-app/releases/latest/download/TubeTV-macOS-Electron-arm64.zip
- Ship command: `./ship.sh "<commit message>"`
- Ship contract: sync this README, run checks, rebuild the macOS release, commit/push source changes, publish/update the GitHub release, install to `/Applications`, and relaunch locally.

## Where to Add Videos

- On a video or Short page, use the floating `+ Next` or `+ Last` buttons near the top-right of the window.
- On Shorts pages, use the bottom `Short + Next / + Last` dock if YouTube's overlay gets in the way.
- On YouTube browse/search/recommendation pages, use the visible `+ Next` or `+ Last` buttons on each thumbnail.
- If the side pane is open, use the `+ Next` or `+ Last` buttons at the top of the Queue tab.
- In the Watch Later tab, `Play` starts from that item and continues to the following Watch Later items in order.

## Login

The Electron app uses its own local profile:

`~/Library/Application Support/YouTube Up Next`

TubeTV intentionally keeps using the older `YouTube Up Next` profile directory so app upgrades keep your YouTube sign-in, local queue, and saved resume state. This profile is separate from Chrome and your other browsers, so existing browser sign-ins are not shared.

Google can reject sign-in inside embedded browsers on some accounts or flows. TubeTV ships only the Electron app.

## Requirements

- Node.js and npm for local Electron development and packaging
- macOS for the packaged desktop app scripts

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

Package and install the macOS Electron app to `/Applications/TubeTV.app`:

```sh
./scripts/install.sh
open "/Applications/TubeTV.app"
```

Install to another path:

```sh
./scripts/install.sh "$HOME/Applications/TubeTV.app"
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

The generated app and zips are build artifacts and are intentionally ignored by git.
