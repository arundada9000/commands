# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

static HTML/CSS/JS single file, no build step at runtime (one-time data-federation build script in `scripts/`). Chosen over a framework because the artifact must open from `file://` offline with zero dependencies; plain static HTML is the only decision that satisfies that constraint without surplus.

## Users

Primary: the author (a working frontend developer) mid-task, looking up and copying a command from his own collected references, then returning to the task. Secondary: peers and students the author shares the file with as a browsable cheat sheet. Success is measured in seconds: find, copy, continue.

## Product Purpose

A single-file command reference ("Command Deck") that aggregates nine tool-specific command collections (Windows, macOS, Linux, Git, npm, pnpm, VS Code, Next.js, DaVinci Resolve) into one searchable, copy-friendly interface that feels like a native iOS app. Success means the user finds the right command within seconds and copies or fills it without leaving the page.

## Positioning

One offline-capable file that federates nine separate collections into a single Spotlight-style lookup with inline placeholder filling, favorites, and copy-in-place. A generic docs site does not open from disk with full fidelity; this one does.

## Operating Context

- Developer opens the file directly from disk (`file://`), often without a network; offline is a hard requirement.
- Lookups happen mid-flow against an editor or terminal, so copy must be one gesture or fewer, with inline inputs for `<placeholder>` arguments.
- The nine source JSON files under `commands/` are the owned, upstream data set and must never be modified by the app or its tooling.
- Occasional sharing with other developers and students.

## Capabilities and Constraints

- Search across command, title, description, and tags; per-tool filtering; per-group sectioning inside a tool; tag filtering.
- Inline placeholder inputs compose the final command for copying on fill.
- Favorites and settings persisted in `localStorage` (survive reload, not file moves).
- Multiple baked-in themes (Daylight, Graphite, Night Shift), auto-following the OS theme when chosen.
- Command palette (keyboard) and documented shortcuts; custom context menu on cards; custom 404 / not-found state for unknown `#routes`.
- Works fully offline; no fonts, scripts, or images are fetched at runtime.
- Constraint: the shipped artifact is one self-contained `index.html`. All CSS/JS/data inline. No PWA/service worker (service workers require HTTP, not `file://`); offline is innate.
- Constraint: single plain JS per browser; data is embedded via a build-time federation step, so source edits require re-running `scripts/build.mjs`.
- Security: static local file, no server, no authentication, no API. Runtime XSS surface is the embedded dataset plus `localStorage`, so all dataset rendering is HTML-escaped. CSP meta tag included.

## Brand Commitments

- Name: "Command Deck" (project working title). Neutral English voice.
- The visual direction is pinned by the user: a full iOS-`like` feel (Human Interface Guidelines principles: clarity, depth, hierarchy, translucency, precision) with an original identity, explicitly "not generic AI slop" and with more than just light/dark themes.
- Developer attribution: Arun Neupane (arundada9000), with the portfolio's "Night Shift" late-night amber identity reused as one of the app's themes and a live Nepal-time clock motif.
- License: MIT.

## Evidence on Hand

- Nine source JSON files under `commands/` (windows, mac, linux, git, npm, pnpm, vscode, nextjs, davinci), totaling 1,946 command entries. Never fabricate or alter entries.
- Incumbent `Commands.html` (the previous dark/light "SajiloDocs" single-file page) is the anti-reference for the redesign; its data handling (fetch of local JSON, dark/light toggle) is evidence of what breaks (`file://` fetch) and what to keep (inline placeholder inputs, favorites via localStorage).

## Product Principles

1. Seconds matter: find, copy, continue. Search and copy are the two actions everything optimizes.
2. Offline is a hard contract: nothing at runtime may require a network.
3. The data stays owned and untouched: all tooling derives from `commands/*.json`, never edits it.
4. Native feel, custom identity: iOS-grade material and motion, not a web-dark-mode facsimile and not generic theme cosmetics.
5. The author's craft is the product's character: tasteful personal touches (live local time, Night Shift palette, console easter eggs) that never obstruct the task.

## Accessibility & Inclusion

- Full keyboard operation, visible focus rings, semantic landmarks, ARIA for palette/dialog/menus, 4.5:1 contrast in both light and dark themes, `prefers-reduced-motion` honored, touch targets at least 44px, text never clipped by fixed font sizes.