---
Title: Intern Review Of The Current Goja Runtime And UI Integration
Ticket: GOJA-RECONCILE-001
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
    - Path: cmd/pod-demo/main.go
      Note: Old default entrypoint that still boots the pod-specific application
    - Path: cmd/scenario-demo/main.go
      Note: New scenario runtime entrypoint that the new UI targets
    - Path: internal/app/app.go
      Note: Legacy app wiring that still serves the old server stack
    - Path: internal/scenario/runtime/session.go
      Note: Current session loop and snapshot publication behavior
    - Path: internal/scenario/server/handler.go
      Note: Current scenario HTTP and WebSocket API
    - Path: internal/web/generate_build.go
      Note: Build pipeline required to refresh embedded frontend assets
    - Path: ui/src/ScenarioApp.tsx
      Note: New uncommitted workbench UI that currently exists outside the embedded production path
ExternalSources: []
Summary: Evidence-based intern guide reviewing the current goja runtime implementation, its strong parts, its split-brain integration problems, and the safest stabilization plan.
LastUpdated: 2026-03-13T15:03:00-04:00
WhatFor: ""
WhenToUse: ""
---

# Intern Review Of The Current Goja Runtime And UI Integration

## Executive Summary

The current state of `GOJA-RECONCILE-001` is not a failed design. It is a partially successful redesign with an integration split. The new scenario runtime is real, testable, and conceptually on the right track. The new UI is also directionally strong and much closer to the imported source than the old pod-specific control room. The main problem is that those good pieces are not yet the default product path.

An intern should understand the situation in one sentence: the repository currently contains two apps at once. One app is the older pod-specific demo (`cmd/pod-demo` -> `internal/app` -> `internal/server` -> `internal/system`). The other app is the newer goja scenario runtime (`cmd/scenario-demo` -> `internal/scenario/server` -> `internal/scenario/runtime`). The nice UI is wired to the second app in Vite development mode, but the repo still serves stale embedded assets and still has the old app as its default server entrypoint. That is the central architectural problem.

## Scope Of This Review

This document is a review of the code as it exists on March 13, 2026. It is not a fresh greenfield proposal. It explains:

- what was built correctly,
- what is structurally wrong or incomplete,
- why the UI can look good while the system is still fundamentally broken,
- what an intern should keep,
- what an intern should replace first,
- how to stabilize the system without throwing away the useful work.

## Validation Evidence

The following commands were run successfully during this review:

- `go test ./... -count=1`
- `go test -race ./internal/scenario/... -count=1`
- `npm --prefix ui run typecheck`
- `npm --prefix ui run build`

One live-server validation attempt could not be completed inside the sandbox:

```text
2026/03/13 14:57:01 http server: listen tcp :3002: socket: operation not permitted
```

That means the review is grounded in source inspection, tests, and build results, but not in a live browser smoke test from this environment.

## Current Architecture Map

### There Are Two Parallel Application Graphs

The repository currently contains both the old and new architectures.

```text
Old default app

cmd/pod-demo/main.go
  -> internal/app/app.go
    -> internal/server/handler.go
      -> internal/system/service.go
        -> controller/state/worker pod demo


New scenario runtime

cmd/scenario-demo/main.go
  -> internal/scenario/catalog
  -> internal/scenario/runtime/session.go
  -> internal/scenario/runtime/vm.go
  -> internal/scenario/server/handler.go
  -> internal/web/spa.go
```

This is not only duplication. It means different entrypoints serve different APIs and different product semantics.

### Development And Production Do Not Point At The Same Thing

In development, Vite proxies `/api` and `/ws` to port `3002`, which is the new scenario runtime backend in [ui/vite.config.ts](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/vite.config.ts#L10). The new React entrypoint also imports `ScenarioApp` in [ui/src/main.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/main.tsx#L1).

In the default Go application path, `cmd/pod-demo` still boots [internal/app/app.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/app/app.go#L21), and that app still serves the old handler from [internal/server/handler.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/server/handler.go#L31). That old handler exposes `/api/snapshot`, `/api/deployments/web`, `/api/chaos/toggle`, and pod lifecycle routes, not the new scenario routes.

This means a developer can easily think "the app works" while actually using a different backend in development than the one the default server path still boots.

## What The New Runtime Gets Right

### 1. The Preset Catalog Boundary Is Good

The filesystem contract in `scenarios/<preset>/...` is a solid abstraction. `catalog.Load` loads:

- `scenario.json`
- `spec.json`
- `ui.json`
- `observe.js`
- `compare.js`
- `plan.js`
- `execute.js`

This is exactly the right direction because it separates host infrastructure from scenario content. The intern should treat the catalog layer in [internal/scenario/catalog/catalog.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/catalog/catalog.go) as worth keeping.

### 2. VM Restart On Preset Switch Is Implemented Correctly

`Session.SwitchPreset` in [internal/scenario/runtime/session.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/session.go#L77) explicitly stops the current loop, creates a fresh VM, resets tick/state, and publishes a preset-change event. That matches the requested behavior and avoids cross-preset contamination.

### 3. The Runtime Phase Split Is Clear

The phase pipeline in [internal/scenario/runtime/session.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/session.go#L218) is exactly the core loop the imported React prototype implied:

1. `observe`
2. `compare`
3. `plan`
4. `execute`

This is readable, debuggable, and teachable.

### 4. The Primitive Surface Is Small Enough

The host primitives exposed in [internal/scenario/runtime/vm.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/vm.go#L34) are narrow:

- `getState`
- `setState`
- `log`
- `randomFloat`
- `randomInt`
- `round`

That is a good first surface. It keeps the VM from becoming a giant unsafe host bridge too early.

### 5. The New UI Direction Is Good

The uncommitted `ScenarioApp` is much closer to the requested product than the old pod dashboard. It has:

- preset switching,
- a transport strip,
- desired-state controls,
- raw JSON editing,
- actual/diff/action panels,
- log streaming.

That matches the intent of the imported source and is a good UX direction for the intern to keep. The problem is not the visual design. The problem is that the runtime contract under it is incomplete and the integration path is split.

## Core Findings

## Finding 1: The Repository Has A Split-Brain Application Topology

Severity: high

The repo still has two different applications wired as first-class citizens. The old one remains the default path, while the new one exists beside it.

Evidence:

- [cmd/pod-demo/main.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/cmd/pod-demo/main.go#L13) still starts `internal/app`.
- [internal/app/app.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/app/app.go#L21) still constructs the old `system.Service` and old `server.NewHandler`.
- [cmd/scenario-demo/main.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/cmd/scenario-demo/main.go#L26) separately loads the scenario catalog and separately constructs the scenario session/handler.
- [ui/vite.config.ts](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/vite.config.ts#L10) points development traffic at `:3002`, which is only the new scenario-demo process.

Why this matters:

- A developer can run the default binary and get the wrong app.
- A browser in Vite dev mode sees a different backend than the default Go application path.
- Shared concepts like "the server" or "the frontend" stop being precise because there are now two of each.

What the intern should conclude:

The first stabilization step is not "tune the websocket" or "add another endpoint". The first stabilization step is to pick one application graph as canonical.

## Finding 2: The Nice UI Is Not The Embedded UI

Severity: high

The new UI work exists in the source tree, builds successfully, and looks like the intended direction. But the embedded assets currently served by Go are stale and still contain the old pod demo.

Evidence:

- [ui/src/main.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/main.tsx#L1) now imports `ScenarioApp`.
- [ui/src/ScenarioApp.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/ScenarioApp.tsx) contains the new workbench.
- The freshly built Vite output in `ui/dist/public/assets/index-BkOM2h6V.js` contains `Reconcile workbench` and `/api/session/*`.
- The currently embedded asset in `internal/web/embed/public/assets/index-C0SybDHH.js` still contains `Pod reconciliation control room` and `/api/snapshot`, `/api/deployments/web`, `/api/chaos/toggle`.
- The embed refresh pipeline exists in [internal/web/generate_build.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/web/generate_build.go#L20), but it has not been run and committed for this new UI state.

Why this matters:

- The nice UI can work in local Vite development and still not be what the Go server actually serves.
- Someone testing only the built Go binary can see the old UI and assume the new UI work is broken or missing.
- Someone testing only Vite can assume the integration is complete when production assets are still stale.

What the intern should conclude:

The UI is not "done" until the served asset path and the development asset path are the same product. Until then, visual progress is partially illusory.

## Finding 3: The Backend Snapshot Contract Is Not Fully Authoritative Yet

Severity: high

The backend currently does not publish authoritative updates for all state mutations. In practice, the frontend patches local state optimistically for some actions and waits for tick-driven updates for others.

Evidence:

- `handleSpec` in [internal/scenario/server/handler.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/server/handler.go#L175) calls `h.session.UpdateSpec(spec)` and returns `{ "ok": true }`. It does not return a fresh snapshot and does not publish a `spec.updated` or `snapshot.updated` event.
- `handleSpeed` in [internal/scenario/server/handler.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/server/handler.go#L192) sets speed and returns a small acknowledgement object. It does not publish a new snapshot either.
- `UpdateSpec` in [internal/scenario/runtime/session.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/session.go#L163) only mutates `s.desired`.
- `SetSpeed` in [internal/scenario/runtime/session.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/session.go#L187) only mutates `s.speedMs`.
- The frontend compensates by mutating local React state in [ui/src/ScenarioApp.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/ScenarioApp.tsx#L729) after `PUT /api/session/spec`.
- The speed slider in [ui/src/ScenarioApp.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/ScenarioApp.tsx#L845) is controlled by `snapshot.speedMs`, but `setSpeed` only fires a POST and does not update local snapshot state.

Why this matters:

- Multi-client sync is broken for spec and speed changes.
- A reconnecting client only converges after a fresh snapshot fetch or another event.
- The frontend is partly rendering server truth and partly rendering optimistic client truth.
- This is exactly the kind of problem users describe as "connection weirdness" even when the websocket itself is technically working.

What the intern should conclude:

The backend must become authoritative for every visible state mutation. Each mutation should either:

- return a fresh snapshot immediately, or
- publish an authoritative update event immediately,

and ideally both.

## Finding 4: The New UI Forced An Extra Backend Route Because The Snapshot Model Is Too Thin

Severity: medium

The new UI needs `ui.json` to render controls, but the main snapshot/preset list does not expose enough information, so an extra route was added: `/api/presets/{id}/ui`.

Evidence:

- The new route exists in [internal/scenario/server/handler.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/server/handler.go#L79).
- The UI fetches it lazily in [ui/src/ScenarioApp.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/ScenarioApp.tsx#L759).

Why this matters:

- This is not catastrophic, but it is a signal that the top-level session contract is incomplete.
- The frontend should not need to reconstruct its operating context through ad hoc side fetches if one active session snapshot is supposed to be authoritative.

What the intern should conclude:

The clean model is:

- preset list for lightweight selection metadata,
- active session snapshot for everything needed to render the current workbench.

That active snapshot should probably include:

- active preset metadata,
- current desired spec,
- current UI schema,
- maybe current phase source text if script inspection is a product goal.

## Finding 5: Tests Validate Local Consistency, Not Real Product Integration

Severity: medium

The tests are fine for unit and handler confidence. They are not enough to protect against the actual failures users will see.

Evidence:

- `go test ./... -count=1` passes.
- `go test -race ./internal/scenario/... -count=1` passes.
- `npm --prefix ui run typecheck` passes.
- `npm --prefix ui run build` passes.

But the tests do not assert:

- that the default Go binary serves the new UI,
- that embedded assets match the current frontend source,
- that the Vite proxy target and the production handler use the same API surface,
- that changing spec/speed converges across clients without a manual re-fetch.

What the intern should conclude:

The current test suite mostly proves "each island works in isolation". It does not prove "the product is coherent as one application."

## Detailed Backend Walkthrough

## The Good Path In The New Runtime

The best way to understand the new runtime is to follow one tick.

```text
HTTP /api/session/run
  -> Session.Run()
  -> goroutine loop
  -> Session.tickLocked()
     -> VM.RunObserve(desired)
     -> VM.RunCompare(desired, actual)
     -> VM.RunPlan(desired, actual, diff)
     -> VM.RunExecute(desired, actual, diff, actions)
  -> snapshot.updated event
  -> websocket client reduces event into UI state
```

This is good because the control-plane loop is in Go and the domain behavior is in JS. That was the correct target architecture.

## The State Model In The VM

The VM stores mutable host state in `vm.kv` in [internal/scenario/runtime/vm.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/vm.go#L19), and JavaScript accesses it via `getState` and `setState`.

That model is serviceable for a demo, but an intern should understand its limits:

- there is no schema for host state keys,
- state is shared by convention only,
- scenario authors can create arbitrary keys,
- exported Go values are accepted as-is.

For the current demo that is acceptable. For a larger system, the next refinement would be to formalize the host state shape or offer a smaller, more explicit host API.

## Why The Session Loop Is Not The Main Problem

It would be easy to blame concurrency because the system uses goroutines, a mutex, and a websocket event stream. The race detector does not show a problem in the current scenario packages. The bigger problems are product-boundary problems:

- wrong default app,
- stale embedded assets,
- incomplete authoritative update contract,
- duplicated bootstrap paths.

This distinction matters because the wrong fix would be a deep runtime rewrite. The right fix is to stabilize ownership and contracts first.

## Detailed Frontend Walkthrough

## What The New UI Does Well

`ScenarioApp` in [ui/src/ScenarioApp.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/ScenarioApp.tsx) is a sensible first workbench:

- It fetches the initial snapshot.
- It opens a websocket for updates.
- It renders preset cards.
- It offers transport controls.
- It supports both schema-driven controls and raw JSON editing.
- It shows actual state, diff, actions, and logs.

This is the right product surface for the current backend.

## Why The UI Still Feels Unstable

The UI is not unstable because of styling or component structure. It feels unstable because some interactions are backed by authoritative server state and some are not.

Examples:

- preset switching re-fetches a full snapshot immediately after POST, which is robust enough,
- spec editing writes to the server but also mutates local React state optimistically,
- speed changes POST to the server but do not update local React state,
- websocket events update only the data the backend currently chooses to publish.

This produces inconsistent mental models:

- some controls feel "live",
- some controls feel delayed,
- some controls appear sticky or revert until another event arrives.

That is a backend contract issue expressed in the UI.

## Recommended Stabilization Plan

## Phase 1: Choose One Canonical App

Recommendation:

- make the scenario runtime the canonical app,
- retire or explicitly archive the old pod-demo path,
- stop shipping two entrypoints that represent two different products.

Concretely:

1. Replace the default application bootstrap so one `app` package owns the scenario runtime.
2. Either delete `cmd/pod-demo` or rename it clearly as legacy.
3. Remove the old `internal/server` and `internal/system` path from the default run path.

Desired end state:

```text
cmd/pod-demo or cmd/app
  -> internal/app
    -> scenario catalog
    -> scenario session/runtime
    -> scenario HTTP+WS handler
    -> embedded current workbench UI
```

## Phase 2: Make Session Mutations Return Authoritative State

Recommendation:

- every mutating endpoint should return the fresh authoritative snapshot,
- every visible mutation should also emit a snapshot or dedicated update event.

Concrete endpoint guidance:

```text
POST /api/session/preset
  response: { ok, snapshot }

PUT /api/session/spec
  response: { ok, snapshot }

POST /api/session/speed
  response: { ok, snapshot }

POST /api/session/run
  response: { ok, snapshot }

POST /api/session/pause
  response: { ok, snapshot }

POST /api/session/reset
  response: { ok, snapshot }
```

This immediately fixes:

- multi-client drift,
- slider/state desynchronization,
- overly optimistic frontend state patching.

## Phase 3: Serve The Same UI In Dev And Production

Recommendation:

1. Keep `ScenarioApp`.
2. Run `go generate ./internal/web`.
3. Commit the refreshed `internal/web/embed/public` assets.
4. Add a CI or test check that fails if `ui/src` and embedded assets drift.

The intern should remember:

- `ui/dist/public` is only an intermediate build product,
- `internal/web/embed/public` is what the Go server actually serves.

If those two are out of sync, the product is out of sync.

## Phase 4: Strengthen The Session Snapshot Model

Recommendation:

Expand the active session snapshot so the frontend does not need side routes for basic rendering context.

Suggested active snapshot shape:

```json
{
  "preset": {
    "id": "space-station",
    "name": "Space station life support",
    "icon": "🛸",
    "description": "..."
  },
  "ui": [ /* ui.json controls */ ],
  "desired": { /* spec */ },
  "actual": { /* observe output */ },
  "diff": { /* compare output */ },
  "actions": [ /* plan output */ ],
  "logs": [ /* bounded runtime log */ ],
  "tick": 12,
  "phase": "idle",
  "running": true,
  "speedMs": 800
}
```

That keeps the browser simple and makes the websocket snapshot genuinely self-contained.

## Phase 5: Add Integration Tests For The Real Product Boundary

Add tests that prove:

- the canonical server serves the intended UI,
- embedded assets contain the current workbench,
- changing spec and speed results in authoritative observable state changes,
- switching presets resets VM state and updates UI schema,
- websocket clients converge without manual re-fetch hacks.

## Pseudocode For The Target Shape

```go
type App struct {
    Catalog *catalog.Catalog
    Session *runtime.Session
    Server  *http.Server
}

func NewApp() (*App, error) {
    cat := loadCatalog("scenarios")
    session := runtime.NewSession(cat.DefaultPreset())
    handler := scenarioserver.NewHandler(cat, session, hub)
    return &App{Catalog: cat, Session: session, Server: newHTTPServer(handler)}, nil
}

func (s *Session) UpdateSpec(spec map[string]any) Snapshot {
    s.mu.Lock()
    defer s.mu.Unlock()

    s.desired = deepCopy(spec)
    s.last = s.buildSnapshot()
    s.hub.Publish("snapshot.updated", s.last)
    return s.last
}

func (h *Handler) handleSpec(w http.ResponseWriter, r *http.Request) {
    spec := decodeSpec(r.Body)
    snapshot := h.session.UpdateSpec(spec)
    writeJSON(w, 200, map[string]any{
        "ok": true,
        "snapshot": snapshot,
    })
}
```

## Practical Advice For The Intern

Do not throw away the following:

- `internal/scenario/catalog`
- `internal/scenario/runtime/vm.go`
- `internal/scenario/runtime/session.go`
- `scenarios/*`
- `ui/src/ScenarioApp.tsx`

Do not build more features on top of the following unresolved faults:

- dual app entrypoints,
- stale embed pipeline,
- non-authoritative mutation responses,
- frontend optimistic state patches as a permanent solution.

If you only have time for one backend fix, do this:

- make every mutation endpoint return and publish a fresh snapshot.

If you only have time for one repo-level fix, do this:

- collapse the app to one canonical server entrypoint and make it serve the current workbench.

## File Reference Map

Start here for architecture:

- [cmd/pod-demo/main.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/cmd/pod-demo/main.go)
- [internal/app/app.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/app/app.go)
- [cmd/scenario-demo/main.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/cmd/scenario-demo/main.go)

Then read the new runtime:

- [internal/scenario/runtime/session.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/session.go)
- [internal/scenario/runtime/vm.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/vm.go)
- [internal/scenario/server/handler.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/server/handler.go)

Then read the UI:

- [ui/src/ScenarioApp.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/ScenarioApp.tsx)
- [ui/src/main.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/main.tsx)
- [ui/vite.config.ts](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/vite.config.ts)

Then inspect embed/build drift:

- [internal/web/generate_build.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/web/generate_build.go)
- [internal/web/embed/public/assets/index-C0SybDHH.js](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/web/embed/public/assets/index-C0SybDHH.js)
- [ui/dist/public/assets/index-BkOM2h6V.js](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/dist/public/assets/index-BkOM2h6V.js)

## Final Recommendation

The current implementation should not be described as "bad backend, good frontend." That is too shallow. The correct diagnosis is:

- the new runtime core is promising,
- the new UI direction is promising,
- the repo currently wires them together inconsistently,
- the default served product is still not the same thing as the new development experience.

Fix the ownership boundary and the authoritative state contract first. After that, the current runtime and current UI are both good foundations to keep building on.
