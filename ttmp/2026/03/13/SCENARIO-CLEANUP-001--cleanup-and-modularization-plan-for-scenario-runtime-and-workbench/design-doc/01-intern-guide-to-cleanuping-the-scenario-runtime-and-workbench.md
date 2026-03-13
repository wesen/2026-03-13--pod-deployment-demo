---
Title: Intern Guide To Cleanuping The Scenario Runtime And Workbench
Ticket: SCENARIO-CLEANUP-001
Status: active
Topics:
    - backend
    - frontend
    - architecture
    - websocket
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: internal/app/app.go
      Note: Canonical app bootstrap and config/path assembly boundary
    - Path: internal/scenario/runtime/session.go
      Note: Authoritative reconcile loop and snapshot publication
    - Path: internal/scenario/runtime/vm.go
      Note: goja host surface and JS primitive boundary
    - Path: internal/scenario/server/handler.go
      Note: HTTP and WebSocket API contract
    - Path: internal/web/generate_build.go
      Note: Embedded frontend build pipeline currently hard-coded to npm
    - Path: ui/src/ScenarioApp.tsx
      Note: Current monolithic workbench requiring modular split
ExternalSources: []
Summary: ""
LastUpdated: 2026-03-13T17:31:00-04:00
WhatFor: Detailed intern-facing cleanup, modularization, and dev-workflow guide for the scenario runtime and workbench.
WhenToUse: Use when onboarding to this repo, simplifying the scenario backend, or splitting the UI into maintainable modules.
---


# Intern Guide To Cleanuping The Scenario Runtime And Workbench

## Executive Summary

The current repository has two truths at once. The good truth is that the new scenario system is real and coherent: presets live in directories, the Go backend loads them into a catalog, a `Session` owns a goja VM and a reconcile loop, the backend exposes HTTP plus WebSocket endpoints, and the new UI presents a strong operator workbench. The bad truth is that the repository still carries an older pod-demo backend and an oversized React entry file, so an unfamiliar engineer can easily waste time reading the wrong code or editing the wrong layer.

This guide explains the system in the order an intern needs to understand it. It starts with how to run the app locally, then maps the current architecture, then explains what is already correct, then explains what should be simplified, and finally gives a phased implementation plan. The goal is not to redesign everything. The goal is to keep the generic goja-driven scenario runtime and reduce the avoidable complexity around it.

The most important recommendations are:

- Keep the scenario runtime architecture centered on `catalog -> session -> server -> workbench`.
- Treat `internal/scenario/runtime` as the core and the old pod-demo backend as legacy until it is archived or removed.
- Split `ui/src/ScenarioApp.tsx` into smaller modules immediately; it is currently doing types, CSS, fetch logic, WebSocket logic, reducers, event decoding, and rendering in one file.
- Standardize the JavaScript toolchain. The repo currently tracks `ui/package-lock.json`, but the desired dev workflow uses `pnpm`.
- Document one canonical way to run the system in `tmux` and one canonical binary entrypoint for humans.

## Problem Statement

An intern opening this repository today will encounter several sources of confusion:

1. There are two backend stacks in the tree.
   The scenario runtime is the active one in `internal/scenario/...`, but the old pod-demo backend still exists in `internal/server` and `internal/system`.

2. There are two binaries that now boot the same app.
   Both `cmd/pod-demo/main.go` and `cmd/scenario-demo/main.go` call `app.New()` and `application.Run(ctx)`.

3. The React workbench is aesthetically strong but operationally monolithic.
   `ui/src/ScenarioApp.tsx` is over one thousand lines and mixes unrelated concerns.

4. The dev-tooling story is inconsistent.
   Vite is configured for a frontend dev server on `:3000` proxying to Go on `:3001`, but the repo tracks `npm` artifacts and the embed build still shells out to `npm`.

5. The current codebase does not make the architecture boundary obvious.
   The clean mental model is "scenario directory -> catalog -> session + goja VM -> HTTP/WS API -> React workbench", but that model is not yet reflected cleanly in the file layout or in the dev instructions.

This document addresses those problems by making the architecture explicit and by proposing concrete simplifications.

## Scope

In scope:

- Local development workflow with Go server plus Vite dev server.
- Backend architecture around `internal/app`, `internal/scenario`, and `internal/events`.
- Legacy-code cleanup decisions for `internal/server` and `internal/system`.
- UI modularization plan for the current workbench.
- Package-manager and embedded-build cleanup.

Out of scope:

- Replacing goja with another runtime.
- Redesigning the scenario preset format.
- Inventing a new transport beyond the current HTTP plus WebSocket contract.
- Reworking the visual design of the UI.

## How To Run The System Today

### Canonical processes

The local system is a two-process setup:

1. A Go server serving the scenario API and embedded SPA on port `3001`.
2. A Vite dev server serving the React workbench on port `3000` by default and proxying `/api` and `/ws` to `3001`.

Relevant files:

- `internal/app/app.go:24-59`
- `internal/scenario/server/handler.go:28-52`
- `ui/vite.config.ts:4-19`
- `ui/package.json:6-10`

### Recommended commands

From the repository root:

```bash
tmux new-session -d -s scenario-dev -c /home/manuel/code/wesen/2026-03-13--pod-deployment-demo 'go run ./cmd/pod-demo'
tmux new-window -t scenario-dev -c /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui 'pnpm dev'
tmux attach -t scenario-dev
```

If you want Vite to fail instead of silently moving to another port, use:

```bash
cd /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui
pnpm dev -- --strictPort --port 3000
```

### What I validated

I launched a real `tmux` session outside the sandbox and observed:

- the Go server bound successfully on `:3001`
- the Vite server started successfully
- Vite shifted to `http://localhost:3003/` because ports `3000`, `3001`, and `3002` were already occupied on the host
- `curl http://127.0.0.1:3001/api/healthz` returned `{"status":"ok"}`
- `curl -I http://127.0.0.1:3003` returned `HTTP/1.1 200 OK`

This means the workflow is valid, but it is easy to get surprised by port collisions. That is another reason to add a small `make dev` or `scripts/dev-tmux.sh` wrapper later.

### Port expectations

```text
Go API / embedded app:  http://localhost:3001
Vite dev server:        http://localhost:3000   (or the next free port)
WebSocket in dev:       ws://localhost:3000/ws  -> proxied to ws://localhost:3001/ws
HTTP API in dev:        http://localhost:3000/api/* -> proxied to http://localhost:3001/api/*
```

## Current Architecture

### High-level map

```text
cmd/pod-demo/main.go          cmd/scenario-demo/main.go
           \                     /
            \                   /
                 internal/app/app.go
                          |
                          v
            internal/scenario/catalog.Load(...)
                          |
                          v
          internal/scenario/runtime.NewSession(...)
                          |
                          +--------------------+
                          |                    |
                          v                    v
      internal/scenario/server/handler.go   internal/events/hub.go
                          |
                          v
                 HTTP + WebSocket API
                          |
                          v
                  ui/src/ScenarioApp.tsx
```

### Entrypoints

Both CLI entrypoints are currently identical:

- `cmd/pod-demo/main.go:13-24`
- `cmd/scenario-demo/main.go:13-24`

Both simply build a signal-aware context, construct `app.New()`, and run it. This is operationally fine, but it is a naming and onboarding problem because the existence of two names implies two behaviors even though there is only one behavior now.

### App bootstrap

`internal/app/app.go:24-59` is the canonical assembly point.

It currently does all of the following in one function:

- reads `ADDR`
- resolves the scenarios directory
- loads the catalog
- picks the first preset
- creates the event hub
- creates the scenario session
- creates the HTTP handler
- builds the `http.Server`

This file is not large, but it is shouldering two responsibilities:

- dependency assembly
- environment and repo-root discovery

That is acceptable for a prototype, but not ideal for a cleanup phase.

### Catalog loading

`internal/scenario/catalog/catalog.go:19-130` loads every preset directory under the scenario root and reads:

- `scenario.json`
- `spec.json`
- `ui.json`
- `observe.js`
- `compare.js`
- `plan.js`
- `execute.js`

This is one of the cleanest parts of the codebase. The preset directory format is legible, testable, and generic.

### Runtime session

The core runtime lives in `internal/scenario/runtime/session.go:15-326`.

Important responsibilities:

- own the active preset and goja VM
- hold the desired state
- advance the tick loop
- publish authoritative snapshots
- control run, pause, step, reset, and preset-switch behavior

Key public methods:

- `SwitchPreset`: `session.go:79-107`
- `Run`: `session.go:110-127`
- `Pause`: `session.go:130-138`
- `Step`: `session.go:141-149`
- `Reset`: `session.go:152-175`
- `UpdateSpec`: `session.go:178-185`
- `CurrentSnapshot`: `session.go:195-199`
- `SetSpeed`: `session.go:202-212`

The actual reconcile loop is encoded in `tickLocked`: `session.go:235-290`.

That method executes the four phases in strict order:

```text
observe -> compare -> plan -> execute
```

This is the correct core abstraction for the project.

### goja VM host

The VM integration is in `internal/scenario/runtime/vm.go:14-221`.

The host exposes a small primitive surface to JavaScript:

- `getState`
- `setState`
- `log`
- `randomFloat`
- `randomInt`
- `round`

This is also structurally sound. The intern should understand that the project is generic because the phase behavior lives in scenario JavaScript, while Go owns the lifecycle, ticking, transport, and hosting.

### HTTP and WebSocket API

The API is assembled in `internal/scenario/server/handler.go:28-52`.

Endpoints:

- `GET /api/healthz`
- `GET /api/presets`
- `GET /api/presets/{id}/ui`
- `POST /api/session/preset`
- `POST /api/session/run`
- `POST /api/session/pause`
- `POST /api/session/step`
- `POST /api/session/reset`
- `GET|PUT /api/session/spec`
- `POST /api/session/speed`
- `GET /api/session/snapshot`
- `GET /ws`

This contract is functional and easy to understand. The remaining cleanup work is mostly about tightening it, not replacing it.

### Event bus

`internal/events/hub.go:11-58` is a simple in-process pub/sub hub with buffered channels.

For this repo, that is a good default. Nothing in the current codebase justifies adding Watermill, NATS, or an HTTP hop between goroutines. The transport boundary that matters is browser-to-server, and that is already handled via HTTP plus WebSocket.

### Current UI

`ui/src/ScenarioApp.tsx` is the current workbench entrypoint.

It currently contains:

- top-level types: `ScenarioApp.tsx:5-57`
- a giant inline CSS string: `ScenarioApp.tsx:61-635`
- preset fetching: `ScenarioApp.tsx:648-654`
- WebSocket connection logic: `ScenarioApp.tsx:656-699`
- auto-scroll and JSON sync effects: `ScenarioApp.tsx:701-709`
- all HTTP mutation handlers: `ScenarioApp.tsx:713-793`
- the main render tree: `ScenarioApp.tsx:797-977`
- the `DataPanel` subcomponent: `ScenarioApp.tsx:981-1019`
- the recursive control renderer: `ScenarioApp.tsx:1021-1117`
- event reduction logic: `ScenarioApp.tsx:1121-1141`
- fetch helpers: `ScenarioApp.tsx:1143-1179`

This is the single biggest cleanup target in the repository.

## What Is Already Good

An intern should know which parts to preserve.

### The scenario preset format is good

The preset directory contract in `internal/scenario/catalog/catalog.go:67-129` is understandable and easy to extend.

Why it is good:

- it is file-based and observable in git
- it keeps behavior near scenario data
- it allows adding new scenarios without touching core backend code
- it fits the goja-hosting model well

### The session loop is good

`internal/scenario/runtime/session.go:235-290` gives the system a single authoritative place where reconciliation happens. This is better than hiding behavior across frontend state machines or mixing lifecycle changes into ad hoc handlers.

### The backend is already authoritative

The session methods return fresh snapshots and the WebSocket publishes session events. That means the client can, and should, behave as a thin rendering layer instead of inventing its own truth.

### The new UI design is good

The current workbench looks intentional and has a strong operator-console feel. The problem is not the design direction. The problem is that everything is in one file.

## Current Problems And Simplification Opportunities

### 1. The repository still carries a full legacy backend

Evidence:

- `internal/server/handler.go:37-58` still wires the old pod-demo routes.
- `internal/system/service.go:23-146` still implements the old pod lifecycle and chaos flow.

Why this is a problem:

- new engineers can read the wrong stack first
- the existence of two backends weakens the repo narrative
- stale code creates false maintenance cost

Recommended simplification:

- move the old stack under `internal/legacy/poddemo/` if it still matters for reference
- otherwise delete it once tests and docs confirm it is not needed

### 2. Two binaries with the same behavior should not both be first-class forever

Evidence:

- `cmd/pod-demo/main.go:13-24`
- `cmd/scenario-demo/main.go:13-24`

Why this is a problem:

- docs become ambiguous
- `tmux` and smoke-test scripts have to pick a name
- onboarding starts with a naming question that adds no value

Recommended simplification:

- choose one canonical binary name
- keep the other as an alias temporarily if needed
- document the canonical name in README and dev scripts

### 3. Bootstrap code mixes assembly with environment discovery

Evidence:

- `internal/app/app.go:24-59` assembles the app
- `internal/app/app.go:87-118` discovers scenario paths by walking to `go.mod`
- `internal/web/generate_build.go:15-18` and `internal/web/generate_build.go:61-78` repeat repo-root discovery logic

Why this is a problem:

- duplication creates drift
- path resolution is a cross-cutting concern, not an app concern

Recommended simplification:

- introduce a shared helper package for repo-root and scenarios-dir resolution
- keep `internal/app/app.go` focused on wiring dependencies

### 4. The JS toolchain is inconsistent

Evidence:

- desired dev command: `pnpm dev`
- tracked lockfile: `ui/package-lock.json`
- embed build command: `internal/web/generate_build.go:20-25` runs `npm --prefix ... run build`
- frontend scripts: `ui/package.json:6-10`

Why this is a problem:

- package manager drift causes install friction
- CI and local workflows can diverge silently
- intern instructions become caveated instead of simple

Recommended simplification:

- choose `pnpm` or `npm`
- add the corresponding lockfile and `packageManager` metadata
- update the embed build script to use the same convention

### 5. The UI file is doing too many jobs

Evidence:

- `ui/src/ScenarioApp.tsx:61-635` contains styling
- `ui/src/ScenarioApp.tsx:656-699` owns socket lifecycle
- `ui/src/ScenarioApp.tsx:713-793` owns mutations
- `ui/src/ScenarioApp.tsx:797-977` owns rendering
- `ui/src/ScenarioApp.tsx:1121-1179` owns data-reduction and fetch helpers

Why this is a problem:

- hard to review
- hard to test
- hard to safely edit without regressions
- pure logic and UI logic are tightly coupled

Recommended simplification:

- split the file by responsibility, not by arbitrary line count

### 6. The API contract can be made easier to reason about

Evidence:

- `internal/scenario/server/handler.go:129-145`, `152-176`, `188-208` wrap snapshots in `{ok, snapshot}`
- WebSocket emits typed events via `internal/events/hub.go:42-57`
- the frontend still has a local event reducer in `ui/src/ScenarioApp.tsx:1121-1141`

Why this is a problem:

- there are multiple update shapes in play
- the client needs to know event taxonomy details

Recommended simplification:

- keep authoritative snapshots
- consider shrinking the event vocabulary to "authoritative snapshot arrived" plus "runtime error"
- if granular events remain useful, ensure they all reduce to the same snapshot shape

## Recommended Target Architecture

### Backend target

```text
cmd/scenario-demo (canonical)
        |
        v
internal/app
  - config loading
  - dependency assembly only
        |
        v
internal/scenario/
  catalog/
  runtime/
  server/
  model/
        |
        v
internal/events/
```

The backend should remain generic. Go owns lifecycle, concurrency, transport, and authority. JavaScript owns scenario-specific behavior through the four phase scripts.

### UI target

Recommended split:

```text
ui/src/scenario/
  types.ts
  api.ts
  reducer.ts
  useScenarioSession.ts
  renderControl.tsx
  workbench.css
  components/
    ScenarioWorkbench.tsx
    PresetStrip.tsx
    TransportBar.tsx
    SpecPanel.tsx
    StatePanels.tsx
    DataPanel.tsx
    RuntimeLogPanel.tsx

ui/src/ScenarioApp.tsx
  - tiny composition root only
```

This split is intentionally boring. That is a compliment. Maintenance improves when each module has one reason to change.

## Proposed Frontend Module Responsibilities

### `types.ts`

Move all transport and view-model types out of the component file.

Candidates from the current file:

- `PresetMeta`
- `Snapshot`
- `ServerEvent`
- `UIControl`

### `api.ts`

Own the HTTP calls:

- `listPresets()`
- `fetchSnapshot()`
- `switchPreset()`
- `runSession()`
- `pauseSession()`
- `stepSession()`
- `resetSession()`
- `updateSpec()`
- `setSpeed()`

Each function should return typed data and hide the `{ ok, snapshot }` envelope.

### `reducer.ts`

Own `reduceEvent` and any local client-state transitions that are independent of rendering.

### `useScenarioSession.ts`

Own:

- initial snapshot load
- WebSocket connect and reconnect
- mutation actions
- connection state
- error state

### `renderControl.tsx`

Own the recursive control rendering currently in `ScenarioApp.tsx:1021-1117`.

### `workbench.css`

Own the styles currently held in the inline template string at `ScenarioApp.tsx:61-635`.

### Presentational components

Break the render tree into stable chunks:

- `PresetStrip`
- `TransportBar`
- `SpecPanel`
- `StatePanels`
- `RuntimeLogPanel`

These should receive props, not fetch data.

## Proposed Backend Cleanup

### Keep

- `internal/scenario/catalog`
- `internal/scenario/runtime`
- `internal/scenario/server`
- `internal/scenario/model`
- `internal/events`

### Simplify

#### `internal/app`

Split configuration and assembly:

```text
internal/app/config.go
  - read ADDR
  - read SCENARIOS_DIR

internal/app/paths.go
  - find repo root
  - resolve scenarios dir

internal/app/app.go
  - build catalog
  - build hub
  - build session
  - build server
```

#### `internal/web/generate_build.go`

This file should stop hard-coding `npm`. It should either:

- call the chosen package manager directly, or
- call a project script such as `./scripts/build-ui.sh`

The important principle is not "use bash for everything". The important principle is "one JS toolchain story everywhere".

#### Legacy packages

Archive or remove:

- `internal/server`
- `internal/system`

Those packages describe a different system than the one the repo is currently presenting.

## API Reference

### HTTP endpoints

| Method | Path | Purpose | Current implementation |
| --- | --- | --- | --- |
| `GET` | `/api/healthz` | health check | `internal/scenario/server/handler.go:34-36` |
| `GET` | `/api/presets` | list preset metadata | `internal/scenario/server/handler.go:54-77` |
| `GET` | `/api/presets/{id}/ui` | fetch control schema for a preset | `internal/scenario/server/handler.go:79-102` |
| `POST` | `/api/session/preset` | switch presets and rebuild VM | `internal/scenario/server/handler.go:104-136` |
| `POST` | `/api/session/run` | start the tick loop | `internal/scenario/server/handler.go:138-145` |
| `POST` | `/api/session/pause` | pause ticking | `internal/scenario/server/handler.go:147-154` |
| `POST` | `/api/session/step` | advance one tick | `internal/scenario/server/handler.go:156-167` |
| `POST` | `/api/session/reset` | rebuild the VM for the same preset | `internal/scenario/server/handler.go:169-176` |
| `GET` | `/api/session/spec` | fetch current desired state | `internal/scenario/server/handler.go:178-193` |
| `PUT` | `/api/session/spec` | replace desired state | `internal/scenario/server/handler.go:178-193` |
| `POST` | `/api/session/speed` | change tick interval | `internal/scenario/server/handler.go:195-209` |
| `GET` | `/api/session/snapshot` | fetch current authoritative state | `internal/scenario/server/handler.go:211-217` |
| `GET` | `/ws` | subscribe to runtime events | `internal/scenario/server/handler.go:219-244` |

### Snapshot shape

The backend state exposed to the UI is defined in `internal/scenario/runtime/session.go:15-33`.

Important fields:

- `preset`
- `ui`
- `tick`
- `phase`
- `desired`
- `actual`
- `diff`
- `actions`
- `logs`
- `running`
- `speedMs`
- `allLogs`

This shape is already good enough to be the main client contract.

## Pseudocode

### Backend bootstrap

```go
func NewApp() App {
    cfg := loadConfig()
    paths := resolvePaths(cfg)

    cat := catalog.Load(paths.ScenariosDir)
    hub := events.NewHub()
    session := runtime.NewSession(cat.Presets[0], hub)
    handler := scenarioserver.NewHandler(cat, session, hub)

    return App{httpServer: newHTTPServer(cfg.Addr, handler)}
}
```

### Session tick

```go
func tick() Snapshot {
    desired := deepCopy(currentDesired)

    phase = "observe"
    actual = vm.observe(desired)

    phase = "compare"
    diff = vm.compare(desired, actual)

    phase = "plan"
    actions = vm.plan(desired, actual, diff)

    phase = "execute"
    vm.execute(desired, actual, diff, actions)

    logs = vm.flushLogs()
    tick++
    phase = "idle"

    snapshot = Snapshot{desired, actual, diff, actions, logs, ...}
    publish(snapshot)
    return snapshot
}
```

### Proposed React hook

```ts
export function useScenarioSession() {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;

    async function connect() {
      const initial = await fetchSnapshot();
      if (active) setSnapshot(initial);

      ws = openSessionSocket({
        onOpen: () => active && setConnected(true),
        onClose: () => {
          if (!active) return;
          setConnected(false);
          window.setTimeout(connect, 1500);
        },
        onEvent: (event) => active && setSnapshot((cur) => reduceEvent(cur, event)),
        onError: (message) => active && setError(message),
      });
    }

    void connect();
    return () => {
      active = false;
      ws?.close();
    };
  }, []);

  return { snapshot, connected, error, actions };
}
```

## Diagrams

### Tick lifecycle

```text
desired spec
    |
    v
[observe.js] ---> actual state
    |
    v
[compare.js] ---> diff
    |
    v
[plan.js] ------> actions
    |
    v
[execute.js] ---> side effects into VM state
    |
    v
flush logs + publish authoritative snapshot
```

### UI module split

```text
ScenarioApp.tsx
    |
    v
ScenarioWorkbench
    |
    +--> useScenarioSession
    |      +--> api.ts
    |      +--> reducer.ts
    |
    +--> PresetStrip
    +--> TransportBar
    +--> SpecPanel
    |      +--> renderControl.tsx
    +--> StatePanels
    |      +--> DataPanel
    +--> RuntimeLogPanel
```

### Dev loop

```text
tmux session
  window 0: go run ./cmd/pod-demo
      serves :3001
  window 1: pnpm dev
      serves :3000 or next free port
      proxies /api and /ws to :3001
```

## Detailed Implementation Plan

### Phase 1: Make the repo easier to understand without changing runtime behavior

1. Choose one canonical binary name.
2. Update docs and scripts to point to that binary first.
3. Mark the legacy backend as legacy in comments and docs, or move it under a legacy path.
4. Add a single dev script or `make dev` wrapper for `tmux`.

Why first:
This reduces onboarding time immediately without destabilizing the working runtime.

### Phase 2: Standardize the JS toolchain

1. Decide whether the repo uses `pnpm` or `npm`.
2. Add the appropriate lockfile and `packageManager` declaration.
3. Update `internal/web/generate_build.go` to call the chosen package-manager workflow.
4. Verify local build plus embedded build both use the same commands.

### Phase 3: Split the UI by responsibility

1. Extract types.
2. Extract API helpers.
3. Extract reducer logic.
4. Extract WebSocket and mutation orchestration into `useScenarioSession`.
5. Move the CSS into `workbench.css`.
6. Split presentational components.
7. Keep `ScenarioApp.tsx` as a thin composition root.

Validation goals:

- no behavior change
- no visual regression
- simpler review diffs
- easier isolated tests

### Phase 4: Simplify backend assembly

1. Extract config and path resolution helpers from `internal/app/app.go`.
2. Remove duplicate repo-root discovery between app boot and frontend embed build.
3. Decide whether the event stream should remain multi-type or become mostly snapshot-based.
4. Add smoke-test helpers for health, presets, and snapshot retrieval.

### Phase 5: Delete or archive the old pod-demo backend

1. Confirm no tests or docs still rely on `internal/server` or `internal/system`.
2. Move the legacy code out of the active mental path, or delete it.
3. Remove accidental imports or stale references.
4. Re-run the full validation suite.

This phase should come last because deletion is cheap once confidence is high.

## Testing And Validation Strategy

### Manual validation

Use a real two-process session:

```bash
tmux new-session -d -s scenario-dev -c /home/manuel/code/wesen/2026-03-13--pod-deployment-demo 'go run ./cmd/pod-demo'
tmux new-window -t scenario-dev -c /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui 'pnpm dev'
tmux attach -t scenario-dev
```

Then verify:

1. `GET /api/healthz`
2. `GET /api/presets`
3. the active preset renders in the UI
4. run, pause, step, reset all work
5. switching presets restarts the runtime cleanly

### Backend tests

Prioritize:

- catalog-loading tests
- session-state tests
- preset-switch tests
- snapshot publication tests
- scenario-specific regression tests

### Frontend tests

Once the UI is split:

- reducer tests for event handling
- hook tests for reconnect and mutation flows
- component rendering tests for `SpecPanel` and `TransportBar`

## Risks And Tradeoffs

### Risk: removing legacy code too early

If the old pod-demo backend still contains reference behavior someone cares about, deleting it too fast loses that context.

Mitigation:

- archive first if there is uncertainty
- delete later once the team confirms it is dead

### Risk: event simplification could remove useful debugging detail

A snapshot-only stream is easy to reason about, but fine-grained events can still be useful for debugging or future observers.

Mitigation:

- keep event types if they add value
- require every event that mutates client state to carry authoritative snapshot-compatible data

### Risk: a UI split can accidentally change behavior

Refactoring a large component can introduce subtle render or state bugs.

Mitigation:

- extract pure modules first
- keep the visual structure stable while moving logic
- validate each extraction incrementally

## Alternatives Considered

### Rewrite the runtime around a more complex event bus

Rejected for now.

Reason:
`internal/events/hub.go:11-58` is enough for one-process backend broadcasting. Adding Watermill or HTTP between goroutines would increase architecture weight without solving a current problem.

### Keep everything in one React file and only add comments

Rejected.

Reason:
The issue is structural, not cosmetic. Comments do not create test seams or reduce review complexity.

### Preserve both backends indefinitely

Rejected.

Reason:
That preserves ambiguity. A repo can contain legacy code, but it should not make active architecture harder to discover.

## Proposed Solution

The proposed solution is a cleanup-oriented consolidation:

1. Keep the scenario runtime as the architectural center.
2. Make one binary and one dev workflow the documented default.
3. Standardize the JS package manager and embedded-build command.
4. Split the UI into data, transport, view, and style modules.
5. Reduce repo-level ambiguity by archiving or removing the older backend path.

## Open Questions

1. Should `cmd/pod-demo` remain as the canonical binary for naming continuity, or should `cmd/scenario-demo` become the documented entrypoint?
2. Does the team want to standardize on `pnpm`, or was the request to use `pnpm dev` only a local preference?
3. Does `GET /api/presets/{id}/ui` still need to exist once the snapshot already includes the active preset UI schema?
4. Should legacy pod-demo code be archived for educational value, or simply deleted?

## References

- `cmd/pod-demo/main.go:13-24`
- `cmd/scenario-demo/main.go:13-24`
- `internal/app/app.go:24-118`
- `internal/scenario/catalog/catalog.go:19-130`
- `internal/scenario/runtime/session.go:15-326`
- `internal/scenario/runtime/vm.go:14-221`
- `internal/scenario/server/handler.go:28-244`
- `internal/events/hub.go:11-58`
- `ui/package.json:6-21`
- `ui/vite.config.ts:4-19`
- `ui/src/ScenarioApp.tsx:5-1179`
- `internal/web/generate_build.go:14-98`
- `internal/server/handler.go:37-165`
- `internal/system/service.go:23-146`
