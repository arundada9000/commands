# Command Deck: Developer Knowledge Engine

A single-file developer command reference and authoritative technical guides platform that federates nine tool collections into one searchable, copy-ready iOS HIG interface. Opens straight from disk, works fully offline, and installs as a Progressive Web App (PWA).

## Features

- **1,946 commands across 9 tool sets**: Windows, macOS, Linux, Git, npm, pnpm, VS Code, Next.js, DaVinci Resolve.
- **10 In-Depth Technical Guides (SEO / AEO / GEO)**: Deep-dive playbooks and cheat sheets covering Git rebasing, macOS terminal ergonomics, Linux server hardening with systemd, Next.js 15 App Router caching, pnpm monorepos, VS Code keyboard navigation, PowerShell automation, DaVinci Resolve color grading, offline-first PWA architecture, and Generative Engine Optimization.
- **AEO and GEO Structured Data**: Every article includes concise Direct Answer TL;DR boxes, structured FAQs, and Schema.org JSON-LD graph metadata (`TechArticle`, `BlogPosting`, `FAQPage`, `Person`, `SoftwareApplication`).
- **Interactive Data and API Explorer**: Live client-side simulation of REST API endpoints (`/api/commands`, `/api/blogs`, `/api/tools`, `/api/stats`), GraphQL schema queries, and tRPC type-safe procedure routers.
- **Spotlight Search**:
  - `@git` filters to a specific toolset
  - `#setup` filters by tag
  - `"exact phrase"` forces contiguous matching
- **Inline Placeholder Filling**: Commands with `<placeholder>` arguments render editable fields, allowing immediate copying of filled values.
- **Tactile Gestures and Microinteractions**: Double-click to copy, swipe-to-copy, custom iOS frosted glass context menu on right-click or long-press.
- **4 Themes**: Daylight (iOS light), Graphite (Space Gray dark), Night Shift (amber glow dark), and Auto (OS-synchronized).
- **Settings Sheet** (`Mod+,`): Dense layout toggle, sound effects, tactile haptics, and data reset.
- **Progressive Web App (PWA)**: Complete offline caching via `sw.js`, `manifest.webmanifest`, standalone launch mode, and home screen install banner.
- **Live Nepal Time Statusline**: Status bar with live ticking clock (UTC+5:45 NPT) and author watermark.
- **Console Easter Eggs**: Open DevTools and type `help`, `whoami`, `neofetch`, `github`, `hire`, `secret`, `api`, or `cls`.

## Getting Started

1. Open `index.html` directly in any modern web browser (Chrome, Safari, Edge, Firefox).
2. It works instantly offline with zero server requirements, zero npm dependencies, and zero build step at runtime.

## Development Pipeline

```bash
# Build standalone index.html with federated datasets, assets, and guides
node scripts/build.mjs

# Run full test suite (11 test suites covering schema, compression, APIs, and strict rules)
node tests/validate.mjs
```

## Project Structure

```
commands/                 Upstream JSON collections (9 tool sets, read only)
data/blogs.json           10 comprehensive technical guides for SEO, AEO, and GEO
manifest.webmanifest      Web App Manifest for standalone PWA installation
sw.js                     Service worker with offline caching strategy
sitemap.xml               Search engine sitemap with tool and article URLs
robots.txt                Search engine crawl directives
scripts/core.mjs          Core data pipeline, compression, scoring, and API simulation
scripts/build.mjs         Build pipeline compiling assets, commands, and guides
tests/validate.mjs        Validation test suite
src/index.template.html   Source application template
rules/tracker.md          Project progress and decisions tracker
plan.md                   Master architecture and build plan
LICENSE                   Proprietary license
```

## Author and Developer Attribution

- **Developer**: Arun Neupane (arundada9000)
- **Role**: CTO and Lead Architect at Sajilo Digital Pvt. Ltd.
- **Location**: Butwal, Lumbini, Nepal (UTC+5:45)
- **Portfolio**: https://arunneupane.vercel.app
- **GitHub**: https://github.com/arundada9000

## License

Proprietary License. Copyright (c) 2026 Arun Neupane. All rights reserved.
Everything in this repository is licensed exclusively to Arun Neupane.