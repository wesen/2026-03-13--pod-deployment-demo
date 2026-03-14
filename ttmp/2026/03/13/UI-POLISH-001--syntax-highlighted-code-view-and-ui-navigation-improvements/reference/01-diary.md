---
Title: Diary
Ticket: UI-POLISH-001
Status: active
Topics:
    - frontend
    - backend
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/server/handler.go
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/api.ts
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/types.ts
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/components/CodePanel.tsx
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/components/ScenarioWorkbench.tsx
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/components/DataPanel.tsx
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/workbench.css
Summary: "Implementation diary for syntax-highlighted code viewer and UI navigation improvements"
LastUpdated: 2026-03-13T20:08:00-04:00
WhatFor: "Record implementation journey for code review and future reference"
WhenToUse: "When reviewing or continuing work on UI-POLISH-001"
---

# Diary

## Goal

Add a syntax-highlighted code viewer for scenario source files and improve workbench
navigation with a tabbed section layout.

## Step 1: Backend — expose scenario source code via API

Extended the existing `handlePresetDetail` handler to support a `sources` sub-path alongside
the existing `ui` sub-path. The `model.Preset.Sources` struct already contained all four
phase scripts as strings (loaded by the catalog at startup), so no data plumbing was needed —
just routing.

### Prompt Context

**User prompt (verbatim):** "Create a new docmgr ticket to improve the UI, I want to have a syntax highlighted view of the code of the current scenario. Also make the UI a bit nicer and easier to navigate. Write a design analysis and create tasks in the ticket, then work them off one by one, committing as you go, keeping an implementation diary (read the relevant skills)"

**Assistant interpretation:** Create a structured ticket, design the approach, then implement: (1) API endpoint for scenario sources, (2) syntax-highlighted code panel, (3) tabbed navigation, (4) visual polish.

**Inferred user intent:** Make the workbench more useful for understanding scenario logic by exposing the source code with good readability, and reduce information overload with better navigation.

**Commit (code):** a46d7d1 — "feat(api): add /api/presets/{id}/sources endpoint"

### What I did
- Changed `handlePresetDetail` from a single `"ui"` match to a `switch` on `parts[1]`
- Added `"sources"` case returning `preset.Sources`

### Why
The frontend needs scenario source code to display it. The data was already loaded in memory.

### What worked
- Clean extension of existing handler pattern — no new routes needed

### What didn't work
- N/A

### What I learned
- The catalog already loads all `.js` source files as strings at startup

### What was tricky to build
- Nothing — straightforward routing extension

### What warrants a second pair of eyes
- N/A

### What should be done in the future
- N/A

### Code review instructions
- File: `internal/scenario/server/handler.go:80-103`
- The `handlePresetDetail` function now uses a switch instead of a hardcoded `"ui"` check

### Technical details
```
GET /api/presets/{id}/sources → { "observe": "...", "compare": "...", "plan": "...", "execute": "..." }
```

## Step 2: Frontend — types and API function

Added `PresetSources` type and `fetchPresetSources` API function to the frontend.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Commit (code):** 30f0298 — "feat(frontend): add PresetSources type and fetchPresetSources API"

### What I did
- Added `PresetSources` type to `types.ts`
- Added `fetchPresetSources(presetId)` to `api.ts` using existing `parseJSON` helper

### Why
Need typed access to the new sources endpoint before building the UI component.

### What worked
- Followed existing API patterns (`parseJSON`, URL encoding)

### What didn't work
- N/A

### What I learned
- N/A

### What was tricky to build
- N/A

### What warrants a second pair of eyes
- N/A

### What should be done in the future
- N/A

### Code review instructions
- Files: `ui/src/scenario/types.ts`, `ui/src/scenario/api.ts`
- New type and function follow existing patterns exactly

## Step 3: CodePanel with highlight.js syntax highlighting

Installed highlight.js and created a new `CodePanel` component with tabbed sub-views for
each reconciliation phase (observe, compare, plan, execute). Built a custom syntax theme
using CSS classes mapped to the existing workbench color palette (violet for keywords,
cyan for operators/attrs, green for strings, amber for numbers).

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Commit (code):** 7523fa5 — "feat(frontend): add CodePanel with syntax-highlighted source viewer"

### What I did
- Installed `highlight.js` via pnpm
- Registered only the JavaScript language (tree-shakeable)
- Created `CodePanel.tsx` with phase tabs and line-numbered code display
- Added custom syntax theme CSS classes (`.wb-code-pre .hljs-*`) harmonized with workbench palette
- Added section tab CSS (`.wb-section-tabs`, `.wb-section-tab`)

### Why
highlight.js is lightweight, supports selective language loading, and can be themed via CSS
classes — perfect for matching the existing dark palette without importing a third-party theme.

### What worked
- `hljs.highlightElement` works well with React refs
- Custom token colors using existing CSS variables look native to the workbench

### What didn't work
- N/A

### What I learned
- highlight.js allows registering individual languages to minimize bundle size
- The `highlightElement` API mutates the DOM in-place, so using `textContent` reset + re-highlight on source change works cleanly

### What was tricky to build
- Getting the line numbers to align with highlighted code: used a CSS Grid with a separate gutter column that renders line-number spans, matching the code's `line-height: 1.65`

### What warrants a second pair of eyes
- The `useEffect` that calls `hljs.highlightElement` mutates the code element directly. This works because we reset `textContent` before re-highlighting, but it's a side-effect outside React's render cycle.

### What should be done in the future
- Consider using `hljs.highlight(source, {language: "javascript"}).value` and setting `dangerouslySetInnerHTML` for a more React-idiomatic approach (but current approach is simpler)

### Code review instructions
- File: `ui/src/scenario/components/CodePanel.tsx`
- CSS: `ui/src/scenario/workbench.css` — search for "Code panel" and "Syntax highlighting theme"

## Step 4: Section tabs and workbench integration

Restructured `ScenarioWorkbench` to add a tab bar (Dashboard / Code / Logs) below the
transport controls. The Dashboard tab retains the original spec + state grid with an inline
log panel. The Code tab shows the new CodePanel. The Logs tab promotes the runtime log to
a full-width dedicated view with more scroll height.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Commit (code):** 70e679e — "feat(frontend): add section tabs and wire CodePanel into workbench"

### What I did
- Added `activeSection` state (`"dashboard" | "code" | "logs"`)
- Added `sources` and `sourcesLoading` state with a `useEffect` that fetches on preset change
- Rendered section tab buttons and conditionally showed content per active tab
- Imported and integrated `CodePanel`

### Why
The original layout stacked everything vertically — spec, 3 data panels, logs — which was
overwhelming. Tabs give each section breathing room and make the code viewer a first-class
citizen without cluttering the dashboard.

### What worked
- Clean conditional rendering: each tab section is a simple `{activeSection === "x" && (...)}`
- Source fetching tied to `snapshot.preset.id` dependency works naturally

### What didn't work
- N/A

### What I learned
- The RuntimeLogPanel appears in both Dashboard (inline) and Logs (dedicated) tabs — this is
  intentional for quick-glance vs. focused viewing

### What was tricky to build
- N/A

### What warrants a second pair of eyes
- Source fetching fires every time preset ID changes. No abort controller for in-flight requests if user switches quickly.

### What should be done in the future
- Add `AbortController` to cancel stale source fetches on rapid preset switching
- Consider persisting tab selection in URL hash for deep linking

### Code review instructions
- File: `ui/src/scenario/components/ScenarioWorkbench.tsx`
- Key change: the `return` JSX now has section tab buttons and conditional rendering

## Step 5: JSON colorization in DataPanel

Replaced plain `JSON.stringify` output in `DataPanel` with a colorized JSON renderer
that tokenizes values and wraps them in styled spans. Keys get cyan, strings green,
numbers amber, booleans purple — matching the syntax theme palette for visual consistency
across the workbench.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Commit (code):** a1ebd51 — "feat(frontend): add JSON syntax colorization to DataPanel"

### What I did
- Wrote `colorizeJSON()` recursive function that returns `ReactNode[]`
- Replaced `JSON.stringify(props.data, null, 2)` with `colorizeJSON(props.data)`
- Added CSS classes: `.wb-json-key`, `.wb-json-str`, `.wb-json-num`, `.wb-json-bool`, `.wb-json-null`, `.wb-json-bracket`, `.wb-json-punct`
- Increased `.wb-log-scroll` max-height from 360px to 560px for the Logs tab

### Why
Colorized JSON is dramatically easier to scan than monochrome text. Building it inline
(rather than importing a library) keeps the bundle small and matches our exact palette.

### What worked
- Recursive approach handles nested objects/arrays cleanly
- Colors match the highlight.js theme for cross-panel consistency

### What didn't work
- N/A

### What I learned
- React can render arrays of mixed `ReactNode` and strings in `<pre>` blocks, which makes
  building inline colorizers straightforward

### What was tricky to build
- Key collision in React: used prefix patterns (`k${i}`, `s${i}`, `c${i}`) for separator
  and comma spans within the map callbacks to avoid key warnings

### What warrants a second pair of eyes
- The `colorizeJSON` function creates many small React elements for large JSON payloads. For very large state objects this could cause rendering overhead. For the current scenario sizes it's fine.

### What should be done in the future
- If performance becomes an issue with large state, consider memoizing the colorized output or switching to `dangerouslySetInnerHTML` with a string-based colorizer

### Code review instructions
- File: `ui/src/scenario/components/DataPanel.tsx`
- The `colorizeJSON` helper at top of file
- CSS: `ui/src/scenario/workbench.css` — search for "JSON colorization"

## Step 6: Fix syntax highlighting and redesign UI

The initial implementation had two problems: (1) `hljs.highlightElement` doesn't play well
with React's rendering cycle — it mutated the DOM but React kept overwriting it, resulting in
monochrome code, and (2) the overall visual design was generic and flat. This step fixed both.

### Prompt Context

**User prompt (verbatim):** "the UI kinda looks like ass doesn't it?"

**Assistant interpretation:** The syntax highlighting isn't working and the visual design needs
a serious quality upgrade.

**Inferred user intent:** Make the UI look genuinely good — not just functional, but visually
distinctive and polished.

**Commit (code):** b6230ca — ":lipstick: Nicer UI"

### What I did
- **CodePanel**: Replaced `hljs.highlightElement` (DOM mutation) with `hljs.highlight` (string-based)
  using `useMemo` + `dangerouslySetInnerHTML`. Added per-phase accent colors (green/amber/violet/rose),
  file indicator with animated colored dot, line count badge.
- **DataPanel**: Rewrote `colorizeJSON` from ReactNode[] to string-based HTML builder to eliminate
  hundreds of "duplicate key" React errors. Same visual output, zero warnings.
- **workbench.css**: Major overhaul:
  - Added radial cyan glow behind the workbench (`::before` pseudo-element)
  - Breathing animation on the status dot
  - Redesigned section tabs: inset dark background, glowing active state, enter animation on tab switch
  - Deeper panel shadows, hover border transitions
  - Code panel: gradient background, separate header bar, per-phase colored tab accents via CSS custom property
  - Bouncy cubic-bezier on toggle thumb
  - Hover states on log lines
  - Responsive code header layout

### Why
The first implementation was functional but aesthetically flat. The frontend-design skill
emphasizes committing to a bold aesthetic direction — the existing dark/cyan/glassmorphic
palette was good but the execution lacked atmosphere and depth.

### What worked
- `hljs.highlight(source, {language: "javascript"}).value` with `useMemo` is the correct
  React-idiomatic approach — instant, no DOM mutation side effects
- String-based HTML for both JSON colorization and syntax highlighting eliminates all React
  key management complexity
- CSS `color-mix()` for per-phase tab accent colors works cleanly

### What didn't work
- `hljs.highlightElement` never worked correctly with React — it mutates innerHTML but React
  re-renders from virtual DOM, causing the highlighted content to be overwritten or logged
  as "Element previously highlighted"
- ReactNode[] approach for JSON colorization caused key collisions because recursive calls
  reuse the same key prefixes at different nesting levels

### What I learned
- For syntax highlighting in React, always use the string-based API (`hljs.highlight`) rather
  than the DOM-mutation API (`highlightElement`)
- `dangerouslySetInnerHTML` is the right tool when you're building trusted HTML from known
  data (syntax highlighting, JSON colorization) — fighting React's key system is worse
- `color-mix(in srgb, ...)` is well-supported and great for dynamic accent theming in CSS

### What was tricky to build
- Getting the per-phase accent color into the active tab: used a CSS custom property
  `--tab-accent` set via inline style on the active button, then referenced in the CSS rule
  with `color-mix(in srgb, var(--tab-accent) 18%, transparent)` for the background

### What warrants a second pair of eyes
- Using `dangerouslySetInnerHTML` in DataPanel for user-controlled data. The `colorizeJSON`
  function escapes `<`, `>`, and `&` in string values, but worth verifying no injection path
  exists through the JSON keys or values coming from the scenario runtime.

### What should be done in the future
- Consider adding a line-highlight effect that follows the current execution phase in the
  code panel (e.g., highlighting the active function during observe/compare/plan/execute)

### Code review instructions
- `CodePanel.tsx`: the `useMemo` + `hljs.highlight` pattern at lines 28-31
- `DataPanel.tsx`: the string-based `colorizeJSON` function
- `workbench.css`: search for the section comments (`═══`) for major sections
