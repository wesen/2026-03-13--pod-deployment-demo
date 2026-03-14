---
Title: Design Analysis
Ticket: UI-POLISH-001
Status: active
Topics:
    - frontend
    - backend
DocType: design
Intent: long-term
Owners: []
RelatedFiles:
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/components/ScenarioWorkbench.tsx
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/workbench.css
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/server/handler.go
    - /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/model/model.go
Summary: "Design analysis for adding syntax-highlighted scenario code viewing and improving workbench navigation"
LastUpdated: 2026-03-13T19:50:30.758059988-04:00
WhatFor: "Guide implementation of code viewer and UI polish"
WhenToUse: "When working on UI-POLISH-001 tasks"
---

# Design Analysis: Code View & Navigation Improvements

## Current State

The Reconcile Workbench is a dark-themed ops console for running reconciliation scenarios.
The layout is a vertical stack: header, preset strip, transport bar, two-column grid
(spec editor + 3 data panels), and a log panel at the bottom.

**What's missing:**
- No way to view the scenario source code (plan.js, execute.js, compare.js, observe.js)
- All state data panels (Actual, Diff, Actions) show raw `JSON.stringify` output with no highlighting
- The layout is a flat vertical scroll with no navigation structure — everything is visible at once
- On smaller screens the information density becomes overwhelming

## Design Direction

**Aesthetic**: Evolve the existing dark console aesthetic. The current palette (deep navy,
cyan accents, glassmorphic panels, JetBrains Mono) is already distinctive. Don't replace it —
sharpen it. Add a tabbed section navigator that gives the workbench a feeling of depth,
like switching between views on an instrument panel.

**Key design move**: A horizontal tab bar below the transport controls that splits the
workbench into focused views: **Dashboard** (current grid), **Code** (new syntax-highlighted
source viewer), and **Logs** (promoted from bottom). This reduces vertical scroll,
gives each section breathing room, and makes the code viewer a first-class citizen.

**Typography**: Keep JetBrains Mono for code/data, DM Sans for UI chrome. For the code
viewer, lean into JetBrains Mono with comfortable line-height and subtle line numbers.

**Color for syntax highlighting**: Use a custom token palette that harmonizes with the
existing cyan/violet/green/amber/rose variables rather than importing an off-the-shelf
theme. This keeps the code viewer feeling native to the workbench.

## Architecture

### Backend: Source Code Endpoint

The `model.Preset` already stores all source code as strings in `Sources` (observe,
compare, plan, execute). The handler just needs a new route:

```
GET /api/presets/{id}/sources → { observe: string, compare: string, plan: string, execute: string }
```

Extend `handlePresetDetail` to also match `sources` (alongside existing `ui`).

### Frontend: Syntax Highlighting

Use **highlight.js** — lightweight, has a good JavaScript grammar, and can be themed
via CSS classes that map to our existing CSS variables. No build-time complexity.

### Frontend: Section Tabs

Add a `SectionTabs` component that renders tab buttons and conditionally shows one of:
- **Dashboard**: The existing SpecPanel + StatePanels grid
- **Code**: New `CodePanel` with sub-tabs for each phase file
- **Logs**: The existing RuntimeLogPanel (promoted to full-width tab)

### Frontend: Code Panel

A new `CodePanel` component:
- Fetches sources from `/api/presets/{id}/sources` when preset changes
- Sub-tabs for: observe, compare, plan, execute
- Syntax-highlighted JavaScript with line numbers
- Styled to match the workbench dark theme

## Tasks

1. **Backend**: Add `/api/presets/{id}/sources` endpoint
2. **Frontend**: Add `fetchPresetSources` to `api.ts`
3. **Frontend**: Install highlight.js, create `CodePanel` component with syntax highlighting
4. **Frontend**: Add section tab navigation to workbench (Dashboard / Code / Logs)
5. **Frontend**: Wire CodePanel into the workbench, fetch sources on preset change
6. **Frontend**: Visual polish — JSON syntax highlighting in DataPanel, spacing refinements
