# Timezone Helper

A visual timezone tracking tool for globally distributed teams. See what time it is for every colleague at a glance — drag a needle across a 24-hour timeline to explore any moment in any timezone, with full DST awareness.

---

## What it does

### Live timeline view
The app renders one row per timezone. Each row shows a 24-hour band of hour blocks colour-coded by work status:

| Colour | Meaning |
|---|---|
| Green | Core working hours (09:00–18:00 local) |
| Amber | Early / late hours (07:00–09:00 and 18:00–20:00 local) |
| Grey | Off hours |

A vertical blue **needle** spans all rows simultaneously. In **Live mode** it tracks the current time and auto-advances every 30 seconds. Drag it left or right to explore any point in the day.

### Draggable time needle
- Drag the needle handle to any position on the timeline
- Every row instantly shows the exact local time at that point
- Dragging automatically exits Live mode; click **Back to live** to re-engage it

### DST-aware time display
All time conversion uses the browser's built-in `Intl.DateTimeFormat` API against IANA timezone identifiers. Daylight saving transitions are handled automatically — no hardcoded UTC offsets. Switching the date to a DST transition day (e.g. the Sunday clocks change) immediately recalculates every row's offset correctly.

### Date navigation
The date picker in the header lets you jump to any day — past or future. This is especially useful for planning around upcoming DST changes or scheduling meetings across quarters.

### Add and remove timezones
- Click **Add timezone** to open a modal with ~40 curated IANA zones grouped by continent
- Optionally attach a person name or team label to each row
- Rows can be removed at any time by hovering and clicking the × button
- Supports 7+ timezones; a dismissible banner appears when the list grows large enough to require horizontal scrolling

### Persistent state
All timezone rows and preferences are saved to `localStorage` under a versioned key (`tz-helper-v1`). The app restores your exact configuration on next visit, including the last-used date. The storage schema is versioned and structured for extension (see [Future roadmap](#future-roadmap)).

---

## Default timezones

The app ships with four pre-configured zones:

| Flag | Location | IANA identifier |
|---|---|---|
| 🇵🇹 | Lisbon, Portugal | `Europe/Lisbon` |
| 🇩🇪 | Berlin, Germany | `Europe/Berlin` |
| 🇺🇦 | Kyiv, Ukraine | `Europe/Kyiv` |
| 🇮🇳 | Bangalore, India | `Asia/Kolkata` |

These are only shown on first launch. If you've previously saved your own configuration, that takes precedence.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19.1 |
| Language | TypeScript 5.8 (strict mode) |
| Build tool | Vite 6 |
| Styling | Tailwind CSS v4 |
| UI primitives | Radix UI (Dialog, Select, Label, Slot) |
| Component styling | shadcn/ui patterns (copy-paste, project-owned) |
| Icons | Lucide React |
| Time conversion | Native `Intl.DateTimeFormat` — no date libraries |
| State | React `useReducer` + `useOptimistic` (React 19) |
| Persistence | `localStorage` — no backend |

### React 19 features in use

This project targets React 19 and uses several of its new capabilities:

- **`useActionState`** — the Add Timezone form manages its pending/error state through a server action–style callback, eliminating manual `isSubmitting` booleans
- **`useOptimistic`** — added timezones appear instantly in the UI before the state write completes
- **`ref` as a plain prop** — the `Needle` and `TimelineGrid` components accept refs directly without `forwardRef`
- **Native `<title>` hoisting** — `<title>Timezone Helper</title>` is rendered inside the component tree; React 19 moves it to `<head>` automatically

---

## Project structure

```
timezone-helper/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx                   # React 19 root mount
    ├── App.tsx                    # Root — useReducer state, useOptimistic zones
    ├── types.ts                   # Shared interfaces: Zone, HourBlock, AppState, StorageSchema
    ├── index.css                  # Tailwind entry + needle/hour-block CSS custom properties
    ├── lib/
    │   └── utils.ts               # cn() helper (clsx + tailwind-merge)
    ├── components/
    │   ├── Header.tsx             # Live clock, date picker, action buttons
    │   ├── TimelineGrid.tsx       # Scroll container, composes rows + needle
    │   ├── HourRuler.tsx          # Sticky 00–23 column header
    │   ├── TimelineRow.tsx        # Single timezone row: flag, time, hour blocks
    │   ├── Needle.tsx             # Draggable vertical bar (Pointer Events API)
    │   ├── AddTimezoneModal.tsx   # Add zone form using useActionState
    │   └── ui/                    # shadcn/ui base components (project-owned)
    │       ├── button.tsx
    │       ├── dialog.tsx
    │       ├── input.tsx
    │       ├── label.tsx
    │       └── select.tsx
    └── utils/                     # Pure functions — no React, no DOM
        ├── timezones.ts           # Time math: formatTimeInZone, buildHourBlocks, pixel↔UTC
        ├── storage.ts             # localStorage read/write with version check
        └── constants.ts           # Default zones, HOUR_WIDTH_PX, curated IANA zone list
```

**Architecture rule:** `utils/` contains only pure functions with no React or DOM dependencies. Components contain only rendering and event handling — no time math.

---

## Getting started

### Prerequisites

- Node.js 18 or later
- npm (comes with Node.js)

### Installation

```bash
# Clone or download the project
cd timezone-helper

# Install dependencies
npm install
```

### Running locally

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Building for production

```bash
npm run build
```

Output goes to `dist/`. The result is a fully static site — drop it on any static host (Vercel, Netlify, GitHub Pages, S3).

```bash
# Preview the production build locally
npm run preview
```

---

## Deploying with vibectl (Vibe Platform)

This repository is configured to deploy through Vibe Control Plane.

### What gets deployed

- Source code from the current Git commit on `main`
- Build/deploy configuration from `vibecoding.yaml` in the repo root
- For this project, `vibecoding.yaml` defines a static app build:
  - `type: static`
  - `build.command: npm run build`
  - `output: dist`

### Where code is pushed

- Git remote (`origin`): `https://github.com/sixt-vibe/mammoth-work-2374.git`
- Active branch: `main` (tracks `origin/main`)

Check this at any time:

```bash
git remote -v
git branch -vv
```

### Standard release flow

```bash
# 1) Make changes and validate locally
npm run build

# 2) Commit and push
git add .
git commit -m "feat: describe your change"
git push origin main

# 3) Trigger build from the exact pushed commit
vibectl build trigger --project timezone-helper --commit $(git rev-parse HEAD)

# 4) Wait for build success
vibectl build status --project timezone-helper

# 5) Deploy that same commit
vibectl deploy trigger --project timezone-helper --commit $(git rev-parse HEAD)

# 6) Verify deployment and endpoint health
vibectl deploy status --project timezone-helper
```

### Live endpoint

- Current app URL: `https://mammoth-work-2374.prod.vibecoding.sixt.cloud`

### Authentication

If a `vibectl` command fails due to expired auth, run:

```bash
vibectl login
```

### Notes on history

During Vibe bootstrap, the repository metadata was switched to the Vibe-managed remote. If you need older pre-bootstrap local history, it is preserved in `.git_backup` and can be viewed with:

```bash
git --git-dir=.git_backup --work-tree=. log --oneline
```

---

## localStorage schema

The app stores everything under the key `tz-helper-v1`. The schema is versioned to allow safe migrations in future releases:

```json
{
  "version": 1,
  "zones": [
    {
      "id": "uuid",
      "tz": "Europe/Lisbon",
      "label": "Lisbon",
      "flag": "🇵🇹",
      "person": "João"
    }
  ],
  "preferences": {
    "selectedDate": "2026-03-27",
    "isLive": true
  }
}
```

Reserved fields for future use: `profiles`, `user`.

---

## Future roadmap

These are planned enhancements — not yet implemented.

### Phase 2: Scheduling & integration

**Best meeting time finder**
Automatically highlight the time slot where the most (or all) configured timezones overlap within their core working hours. Useful for finding a 1-hour window that works for everyone without manually cross-referencing rows.

**Calendar integration (Outlook / Google Calendar)**
When the needle is positioned on a time that works for all zones, a "Create meeting" button would open a pre-filled meeting request. This requires an MCP server or OAuth integration with the calendar provider. Scoped as phase 2 to avoid scope creep on the core tool.

**Share URL**
Encode the current zone list and needle position into a URL query string. Send the link to a colleague and they see exactly the same view — useful for async handoffs ("I'm available at this time").

### Phase 3: Profiles & personalisation

**Named profiles**
Save multiple zone sets under names like "EU Team", "All Hands", "Sprint planning". Switch between them from the header. Stored in the existing `profiles` reserved field in `localStorage`.

**DST change alerts**
Show a banner in the header when any configured timezone is switching DST within the next 7 days, with the exact date and the direction of the change (clocks forward / back).

**Holiday overlay**
Dim a timezone's core-hours blocks on public holidays for that country. Source data would be a static bundled JSON of major public holidays — no API required for the basic version.

**Working hours customisation**
Let each timezone row have its own configurable work hours (e.g. a colleague who works 10:00–19:00 instead of 09:00–18:00). Stored per-zone in the `zones` array.

### Technical improvements

**Drag to reorder rows**
Use the HTML5 Drag and Drop API or the Pointer Events API (consistent with the needle implementation) to allow reordering timezone rows. Order is persisted to `localStorage`.

**Keyboard navigation**
Allow the needle to be moved with arrow keys when focused, in increments of 15 or 30 minutes. Required for full accessibility.

**Export to image**
Render the current timeline state as a PNG using the Canvas API. Useful for pasting into Slack or a document.
