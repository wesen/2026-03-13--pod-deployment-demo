---
Title: Intern Guide To A Goja-Driven Reconcile Runtime
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
    - Path: ../../../../../../../../../../../tmp/deployement-demo2.tsx
      Note: Imported source showing preset directories should replace bundled strings
    - Path: internal/controller/controller.go
      Note: Current reconcile orchestration model that should become generic
    - Path: internal/system/service.go
      Note: Current runtime ownership model that should stay in Go
    - Path: ui/src/App.tsx
      Note: Current frontend assumptions that should be replaced by a generic scenario workbench
ExternalSources: []
Summary: Detailed intern-oriented analysis and implementation guide for replacing hardcoded Go reconcile behavior with a generic goja-powered scenario runtime loaded from preset directories.
LastUpdated: 2026-03-13T14:09:29.696806643-04:00
WhatFor: ""
WhenToUse: ""
---


# Intern Guide To A Goja-Driven Reconcile Runtime

## Executive Summary

This ticket proposes the next architectural step for the demo system: keep the core runtime, scheduling, transport, persistence boundaries, and lifecycle ownership in Go, but move scenario-specific reconciliation behavior into JavaScript executed inside a goja VM. The presets should no longer be embedded as strings inside a React component. Instead, each preset becomes a directory of JavaScript and metadata files loaded by the Go backend. Switching presets should restart the VM and reset scenario-local state so each scenario runs in a clean sandbox.

The imported React source in `/tmp/deployement-demo2.tsx` already points toward this model. It has multiple scenario presets and treats reconciliation as four user-editable phases: `observe`, `compare`, `plan`, and `execute` (`/tmp/deployement-demo2.tsx:582-589`, `/tmp/deployement-demo2.tsx:621-652`). But it currently runs those phases in the browser with `new Function(...)`, which means the browser is still the execution environment and the scenario source is still hardcoded into the frontend bundle (`/tmp/deployement-demo2.tsx:631-640`).

The current Go implementation in this repository has the opposite shape. It owns a real reconcile loop and real worker goroutines in Go, but the logic is hardcoded for a single pod-deployment simulation (`[controller.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/controller/controller.go#L16)`, `[service.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/system/service.go#L16)`, `[App.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/App.tsx#L54)`).

The design in this document combines the strengths of both systems:

1. Go remains the control-plane host, process manager, API server, and VM owner.
2. Scenario logic moves into goja-executed JavaScript.
3. Presets live on disk as pluggable directories instead of bundled frontend literals.
4. The frontend becomes a generic reconcile workbench that can browse presets, edit desired state, watch ticks, and inspect actual/diff/actions/logs.

## Problem Statement

The user request is to evolve the system toward a generic architecture:

1. Use a real reconcile loop.
2. Make scenarios pluggable via JavaScript.
3. Launch with different presets discovered from directories containing JS files.
4. Expose a primitive set from Go to the JS VM.
5. Restart the VM when switching presets.
6. Create a detailed design and implementation guide suitable for a new intern.

There are two important "current systems" involved:

1. The new imported React demo source in `/tmp/deployement-demo2.tsx`.
2. The repository’s current Go/React MVP implementation.

Those two systems solve different halves of the problem.

### What the imported React demo does well

The imported source models scenario configurability very well:

- It defines multiple named presets under one `PRESETS` object (`/tmp/deployement-demo2.tsx:12-417`).
- Each preset has:
  - UI DSL controls,
  - desired-state JSON,
  - `observe` code,
  - `compare` code,
  - `plan` code,
  - `execute` code.
- Presets can be switched dynamically in `loadPreset(...)` (`/tmp/deployement-demo2.tsx:605-613`).
- A tick loop runs the four phases in order (`/tmp/deployement-demo2.tsx:621-652`).

This imported source is already close to a "scenario runtime," but it places that runtime in the browser and executes arbitrary code strings with `new Function(...)`.

### What the current repo implementation does well

The current Go codebase models runtime ownership better:

- The reconcile loop is in Go, not in the browser (`[controller.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/controller/controller.go#L34)`).
- Workers are long-lived goroutines (`[manager.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/worker/manager.go#L10)`, `[worker.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/worker/worker.go#L8)`).
- The API and WebSocket event stream are backend-owned (`[handler.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/server/handler.go#L30)`).
- The frontend already consumes a snapshot/event API rather than mutating local truth (`[App.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/App.tsx#L59)`).

But that runtime is still scenario-specific: deployments, pods, workers, and chaos are all hardcoded into Go types and APIs.

### The actual design problem

The design challenge is therefore not "move logic to JS" in a vacuum. The real challenge is:

- keep runtime ownership in Go,
- make scenario logic pluggable and hot-swappable,
- avoid browser-side `new Function(...)`,
- avoid hardcoding one scenario into Go,
- and design a VM boundary that is safe, explicit, observable, and understandable.

## Scope

This document covers:

1. Current-state analysis of the imported React demo and the current repo.
2. Proposed goja-based architecture.
3. Preset directory structure.
4. Reconcile lifecycle and VM boundary.
5. JS primitives exposed from Go.
6. API and WebSocket contracts.
7. Frontend behavior.
8. Proposed file layout.
9. Step-by-step implementation plan.
10. Risks and alternatives.

This document does not implement the goja runtime. It is a detailed design and execution guide for that future work.

## Current-State Analysis

### Imported React demo: evidence-backed architecture

The imported demo is a configurable reconciliation playground in one React component.

#### Scenario catalog and shape

The file defines many scenarios in `PRESETS` (`/tmp/deployement-demo2.tsx:12-417`). Each preset includes:

- `name`
- `icon`
- `ui`
- `spec`
- `observe`
- `compare`
- `plan`
- `execute`

This is the key insight from the imported source. The system is already conceptually decomposed into:

1. desired-state editing,
2. observation,
3. diffing,
4. planning,
5. execution.

That phase decomposition is the right long-term abstraction.

#### Execution model in the browser

The main tick loop is in `runOneTick` (`/tmp/deployement-demo2.tsx:621-652`). It:

1. parses `spec`,
2. runs `observe`,
3. runs `compare`,
4. runs `plan`,
5. runs `execute`,
6. stores a snapshot and logs,
7. increments the tick counter.

The most important implementation detail is that the imported demo uses `new Function(...)` to execute the phase code snippets:

- `observe` at `/tmp/deployement-demo2.tsx:631`
- `compare` at `/tmp/deployement-demo2.tsx:634`
- `plan` at `/tmp/deployement-demo2.tsx:637`
- `execute` at `/tmp/deployement-demo2.tsx:640`

That gives high flexibility, but it also means:

1. the browser executes arbitrary scenario code,
2. scenario logic is bundled into the frontend,
3. there is no backend authority,
4. there is no process isolation boundary,
5. there is no stable JS-to-Go contract yet.

#### Preset switching and runtime reset

Preset switching happens in `loadPreset(...)` (`/tmp/deployement-demo2.tsx:605-613`). It:

- stops the loop,
- swaps the preset strings,
- resets logs and snapshots,
- resets the tick counter,
- resets `stateRef.current = {}`.

This is the semantic behavior we should preserve. The Go backend version should do the same thing, but by replacing or reinitializing the goja VM rather than swapping strings in React state.

### Current repository implementation: evidence-backed architecture

The current repo contains a real backend-backed MVP for the pod demo.

#### Runtime ownership

`Service` wires together the runtime (`[service.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/system/service.go#L16)`):

- store,
- event hub,
- worker manager,
- reconcile controller.

`Start(...)` launches:

- workers,
- worker event consumer,
- controller loop,
- chaos loop

at `[service.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/system/service.go#L38)`.

#### Reconcile ownership

The reconcile algorithm is in Go at `[controller.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/controller/controller.go#L57)`.

This loop is real and useful, but tightly coupled to one specific domain:

- deployment replica count,
- running pods,
- scale-up,
- scale-down,
- worker assignment,
- pod lifecycle.

#### Frontend shape

The current frontend is a pod-specific dashboard (`[App.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/App.tsx#L127)`). It assumes:

- deployment stats,
- worker cards,
- pod buttons,
- pod phases,
- pod kill,
- chaos toggle.

That UI is a good productized control room for the pod demo, but it is not a generic scenario workbench.

## Gap Analysis

There are three important gaps between the imported source and the current repo.

### Gap 1: the imported demo is generic, but browser-owned

The imported React source has the right scenario abstraction, but the wrong execution home.

### Gap 2: the current backend is authoritative, but hardcoded

The Go runtime has the right ownership boundary, but the wrong flexibility boundary.

### Gap 3: current frontend is domain-specific

The current React UI is designed for pods and workers, but the imported source shows the need for:

- preset browsing,
- DSL-driven desired-state controls,
- phase editors,
- tick-oriented snapshots,
- generic `actual`,
- generic `diff`,
- generic `actions`,
- generic logs.

## Proposed Solution

### High-level architecture

Use Go as the host runtime and goja as the scenario execution engine.

Each scenario preset lives in a directory on disk, for example:

```text
scenarios/
  space-station/
    scenario.json
    spec.json
    ui.json
    observe.js
    compare.js
    plan.js
    execute.js
  taco-fleet/
    scenario.json
    spec.json
    ui.json
    observe.js
    compare.js
    plan.js
    execute.js
```

Go loads a preset directory, builds a scenario definition, creates a goja VM, injects primitives, and then runs the four phases inside that VM on every tick.

### Core design principle

The generic architecture should separate:

1. platform/runtime behavior in Go,
2. scenario behavior in JavaScript.

Platform/runtime behavior includes:

- HTTP routing,
- WebSocket fan-out,
- preset discovery,
- VM lifecycle,
- tick scheduling,
- scenario state persistence,
- logging,
- phase timing,
- error boundaries,
- worker goroutine scheduling if needed,
- file watching and preset switching.

Scenario behavior includes:

- world observation,
- scenario-specific diff rules,
- action planning,
- state mutation rules,
- scenario-local data structures,
- and any custom semantics like tacos, space stations, or zombie defenses.

## Target Architecture Diagram

```text
+---------------------------------------------------------------+
| Go Host Process                                               |
|                                                               |
|  +-------------------+     +-------------------------------+  |
|  | HTTP / WS API     | --> | Session / Scenario Manager    |  |
|  | - list presets    |     | - active preset              |  |
|  | - switch preset   |     | - restart VM on switch       |  |
|  | - step/start/stop |     | - tick loop                  |  |
|  | - edit spec       |     | - snapshot history           |  |
|  +-------------------+     +---------------+---------------+  |
|                                               |                |
|                                               v                |
|                                 +---------------------------+  |
|                                 | goja VM                   |  |
|                                 | - observe.js             |  |
|                                 | - compare.js             |  |
|                                 | - plan.js                |  |
|                                 | - execute.js             |  |
|                                 | - host primitives        |  |
|                                 +-------------+------------+  |
|                                               |               |
|                                               v               |
|                                 +---------------------------+ |
|                                 | Snapshot / Event Store    | |
|                                 | - desired                 | |
|                                 | - actual                  | |
|                                 | - diff                    | |
|                                 | - actions                 | |
|                                 | - logs                    | |
|                                 +---------------------------+ |
+---------------------------------------------------------------+
                         |
                         | snapshot + events
                         v
+---------------------------------------------------------------+
| React Workbench                                               |
| - preset selector                                             |
| - UI DSL controls                                             |
| - phase editors                                               |
| - tick counter                                                |
| - actual/diff/actions panels                                  |
| - log stream                                                  |
+---------------------------------------------------------------+
```

## Preset Directory Contract

### Why directories instead of embedded literals

The imported source embeds all presets into one TSX file (`/tmp/deployement-demo2.tsx:12-417`). That is convenient for a sketch, but it is the wrong long-term packaging model because:

1. adding a preset requires rebuilding the frontend bundle,
2. scenario code cannot be shared or versioned independently,
3. backend cannot discover presets at startup,
4. preset switching is UI-state swapping instead of runtime-state swapping.

### Recommended on-disk contract

Each preset directory should contain:

1. `scenario.json`
2. `spec.json`
3. `ui.json`
4. `observe.js`
5. `compare.js`
6. `plan.js`
7. `execute.js`
8. optional assets/docs later

Suggested `scenario.json`:

```json
{
  "id": "space-station",
  "name": "Space station life support",
  "icon": "🛸",
  "description": "Life-support reconciliation example",
  "initialTickMs": 800
}
```

Suggested `ui.json`:

```json
[
  {
    "type": "group",
    "label": "atmosphere",
    "children": [
      { "type": "slider", "key": "o2Percent", "label": "O2 target %", "min": 15, "max": 30, "step": 0.5 }
    ]
  }
]
```

### Scenario loading rules

Go should validate that all required files exist before activating a preset. The host should reject a preset if:

- a required phase file is missing,
- `scenario.json` is invalid,
- `ui.json` is invalid,
- `spec.json` is invalid JSON,
- or the JS phase scripts fail to compile.

## VM Lifecycle And Preset Switching

### Restart semantics

When the active preset changes, Go should:

1. stop the current tick loop,
2. unsubscribe the old runtime from any timers/workers,
3. discard the existing goja runtime,
4. create a new runtime,
5. load the new preset files,
6. register host primitives,
7. initialize clean scenario state,
8. reset tick/log/snapshot history.

This preserves the good behavior currently seen in the imported `loadPreset(...)` logic (`/tmp/deployement-demo2.tsx:605-613`) while moving the reset into the backend, where it belongs.

### Why restart instead of reusing one VM

Reusing one VM across preset switches would risk:

- leaked globals,
- leaked state,
- stale closures,
- polluted module caches,
- and difficult-to-debug cross-preset behavior.

For intern clarity and runtime hygiene, restarting the VM on preset switch is the right choice.

## Reconcile Loop Ownership

### The reconcile loop should stay in Go

The host should control the sequencing of:

1. fetch desired,
2. run observe,
3. run compare,
4. run plan,
5. run execute,
6. persist snapshot,
7. publish event,
8. sleep/wait for next trigger.

JavaScript should not own the scheduler. JavaScript should provide phase logic. Go should provide loop orchestration.

This is a key design decision because it keeps:

- timing,
- cancellation,
- metrics,
- tracing,
- snapshots,
- and event publication

in one place.

### Host-side tick pseudocode

```go
func (r *Runtime) Tick(ctx context.Context, reason string) error {
    r.mu.Lock()
    defer r.mu.Unlock()

    desired := r.currentDesiredSpec()
    r.phase = "observe"
    actual, err := r.vm.RunObserve(r.state, desired)
    if err != nil { return r.failPhase("observe", err) }

    r.phase = "compare"
    diff, err := r.vm.RunCompare(r.state, desired, actual)
    if err != nil { return r.failPhase("compare", err) }

    r.phase = "plan"
    actions, err := r.vm.RunPlan(r.state, desired, actual, diff)
    if err != nil { return r.failPhase("plan", err) }

    r.phase = "execute"
    if err := r.vm.RunExecute(r.state, desired, actions); err != nil {
        return r.failPhase("execute", err)
    }

    snapshot := Snapshot{
        Tick: r.tick + 1,
        Desired: deepCopy(desired),
        Actual: deepCopy(actual),
        Diff: deepCopy(diff),
        Actions: deepCopy(actions),
        Logs: r.flushBufferedLogs(),
    }

    r.tick++
    r.phase = "idle"
    r.store.Append(snapshot)
    r.events.Publish("snapshot.updated", snapshot)
    return nil
}
```

## JS Runtime Contract

### Phase function contract

Instead of concatenating snippets into `new Function(...)`, the goja runtime should expose named call sites:

- `observe()`
- `compare()`
- `plan()`
- `execute()`

Each phase file should export one function, for example:

```javascript
exports.observe = function () {
  const actual = getState("actual") || { temperature: 18 };
  actual.temperature += randomFloat(-0.5, 0.5);
  setState("actual", actual);
  return actual;
};
```

This is easier to validate, easier to test, and more explicit than assembling function bodies from raw strings.

### JS primitives exposed by Go

The Go host should expose a deliberately small primitive surface.

Recommended primitives:

1. `getState(key)`
2. `setState(key, value)`
3. `mergeState(key, patch)`
4. `getSpec()`
5. `setSpec(value)` if runtime edits are allowed
6. `log(message)`
7. `emitAction(action)` optional if not returning arrays
8. `randomFloat(min, max)`
9. `randomInt(min, max)`
10. `now()`
11. `host.call(name, payload)` for carefully whitelisted host capabilities later

Recommended JS-visible helpers should use lowerCamelCase names to match normal JS expectations.

### Primitive semantics

`getState` / `setState`:

- scenario-local mutable storage,
- preserved across ticks,
- reset on preset switch.

`log`:

- appends to the host-side tick log buffer,
- never writes directly to stdout,
- becomes part of the published snapshot/event stream.

`random*`:

- should come from host-provided randomness,
- ideally with a seedable source for deterministic tests later.

`host.call(...)`:

- should remain tightly controlled,
- should be whitelisted,
- should not expose raw filesystem/network access to scenario JS.

## API References

### Preset management

Recommended HTTP endpoints:

#### `GET /api/presets`

Returns available preset directories discovered by the backend.

```json
[
  {
    "id": "space-station",
    "name": "Space station life support",
    "icon": "🛸"
  }
]
```

#### `POST /api/session/preset`

Switches the active preset and restarts the VM.

Request:

```json
{
  "presetId": "space-station"
}
```

Response:

```json
{
  "ok": true,
  "presetId": "space-station",
  "vmRestarted": true
}
```

### Runtime control

#### `POST /api/session/run`

Starts periodic ticking.

#### `POST /api/session/pause`

Stops periodic ticking.

#### `POST /api/session/step`

Runs one tick.

#### `POST /api/session/reset`

Resets the current scenario state and tick history without switching presets.

### Desired-state editing

#### `PUT /api/session/spec`

Replaces desired spec JSON for the current preset.

#### `GET /api/session/spec`

Returns the current desired spec JSON.

### Live data and events

#### `GET /api/session/snapshot`

Returns the current session state:

```json
{
  "preset": { "id": "space-station", "name": "Space station life support" },
  "tick": 17,
  "phase": "idle",
  "desired": { "o2Percent": 21 },
  "actual": { "o2": 20.8 },
  "diff": {},
  "actions": [],
  "logs": ["Station nominal"],
  "running": true,
  "speedMs": 800
}
```

#### `GET /ws`

Streams:

- `snapshot.updated`
- `session.state`
- `preset.changed`
- `runtime.error`
- `runtime.log`

## Frontend Design

### Frontend goal

The frontend should evolve away from the pod-specific control room in `[App.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/App.tsx#L127)` and toward a generic reconcile workbench that resembles the imported source’s structure (`/tmp/deployement-demo2.tsx:686-833`).

The right UI building blocks are:

1. preset selector,
2. run/pause/step/reset controls,
3. speed control,
4. spec editor with UI DSL and raw JSON view,
5. phase code viewers/editors if editing is desired,
6. tick/phase header,
7. actual/diff/action panels,
8. log stream.

### Frontend should not execute scenario code

This is the most important frontend rule. The browser should never again call `new Function(...)` for scenario code. That browser-side execution in the imported source (`/tmp/deployement-demo2.tsx:631-640`) is what the Go/goja runtime is replacing.

## Proposed File Layout

### Go backend

Recommended new files:

```text
cmd/preset-demo/main.go
internal/scenario/catalog/catalog.go
internal/scenario/catalog/loader.go
internal/scenario/model/model.go
internal/scenario/runtime/runtime.go
internal/scenario/runtime/session.go
internal/scenario/runtime/loop.go
internal/scenario/runtime/snapshot.go
internal/scenario/runtime/primitives.go
internal/scenario/runtime/errors.go
internal/scenario/goja/vm.go
internal/scenario/goja/module_host.go
internal/scenario/goja/phase_loader.go
internal/http/presets_handler.go
internal/http/session_handler.go
internal/http/ws_handler.go
scenarios/<preset-id>/...
```

### Frontend

Recommended new or replacement files:

```text
ui/src/App.tsx
ui/src/api/session.ts
ui/src/api/presets.ts
ui/src/state/session.ts
ui/src/components/PresetSelector.tsx
ui/src/components/SpecPanel.tsx
ui/src/components/PhaseEditorTabs.tsx
ui/src/components/SnapshotPanel.tsx
ui/src/components/ActionList.tsx
ui/src/components/LogPanel.tsx
ui/src/types/scenario.ts
```

## Implementation Plan

### Phase 1: Extract scenario session model in Go

Goals:

1. introduce generic session/snapshot types,
2. stop assuming pods/workers/deployment in the core API,
3. keep the existing Go server and event hub pattern.

Deliverables:

- generic snapshot DTO,
- preset catalog loader,
- session state holder,
- new `/api/presets` and `/api/session/*` surface.

### Phase 2: Add preset directory discovery

Goals:

1. discover preset folders from disk,
2. validate required files,
3. load metadata and phase sources into Go structs.

Validation rules:

- reject missing phase files,
- reject invalid JSON files,
- reject duplicate preset IDs,
- surface compile-time JS errors before activation.

### Phase 3: Introduce goja runtime wrapper

Goals:

1. own a goja runtime per active session,
2. expose only approved host primitives,
3. compile phase scripts once at preset activation,
4. provide typed call helpers for each phase.

Pseudo-structure:

```go
type VM struct {
    rt      *goja.Runtime
    preset  *Preset
    program map[string]*goja.Program
}
```

### Phase 4: Move tick orchestration into generic session loop

Goals:

1. replace pod-specific reconcile logic with phase-driven runtime execution,
2. preserve host-owned tick scheduling,
3. record snapshots and logs after each tick.

### Phase 5: Switch frontend to generic workbench

Goals:

1. render preset metadata from backend,
2. show generic desired/actual/diff/actions/logs panels,
3. remove pod-domain assumptions from the UI.

### Phase 6: Add preset switching with VM restart

Goals:

1. stop loop,
2. rebuild runtime,
3. clear state,
4. publish preset-changed snapshot.

### Phase 7: Hardening and test coverage

Goals:

1. deterministic runtime tests,
2. preset loader tests,
3. phase execution error tests,
4. switch-preset reset tests,
5. frontend reducer/integration tests.

## Testing Strategy

### Backend tests

1. Loader tests for valid and invalid preset directories.
2. VM compile tests for each phase file.
3. Runtime tests proving:
   - `observe` output becomes `actual`,
   - `compare` output becomes `diff`,
   - `plan` output becomes `actions`,
   - `execute` can mutate scenario state via primitives.
4. Preset switch tests proving the VM and state are reset.
5. Snapshot publication tests for the WebSocket/event stream.

### Frontend tests

1. Preset list rendering.
2. Session snapshot reducer behavior.
3. Preset switch state reset.
4. Spec JSON and UI DSL editing.
5. Error display when backend reports runtime failures.

## Design Decisions

### Decision 1: Use goja, not browser-evaluated JS

Rationale: execution belongs in the backend, not in the user’s browser.

### Decision 2: Keep the reconcile loop in Go

Rationale: Go should own timing, cancellation, event publication, and API behavior.

### Decision 3: Presets live in directories, not frontend constants

Rationale: scenario packs should be discoverable and deployable independently of the frontend bundle.

### Decision 4: Restart the VM on preset switch

Rationale: this is the cleanest way to avoid stale state and hidden cross-preset coupling.

### Decision 5: Expose a narrow primitive surface to JS

Rationale: intern-friendly, testable, and safer than giving scenario code broad host powers.

## Alternatives Considered

### Keep using `new Function(...)` in React

Rejected because it keeps the execution engine in the wrong runtime and makes the backend a spectator.

### Port every scenario into Go structs and interfaces

Rejected because the user specifically wants real functionality executed in JS and scenario presets loaded dynamically.

### Reuse one global VM for all presets

Rejected because it increases cross-preset contamination risk and makes reset semantics harder to reason about.

### Let JS own its own loop timing

Rejected because scheduler ownership should remain in Go.

## Risks

1. Too many host primitives could recreate an unsafe scripting environment.
2. Allowing in-browser editing plus server execution may need careful synchronization/versioning rules.
3. Deep-copying large JS objects every tick could become expensive if scenarios grow much larger.
4. If presets require asynchronous IO, the primitive surface and runtime model become more complex.

## Open Questions

1. Should scenario editing be read-only at first, or can users edit JS phase files live from the UI?
2. Should preset directories be watched for hot reload during development?
3. Should each browser session have its own runtime, or should the server host one shared runtime per active preset?
4. How much of the current pod-specific code should be kept versus replaced during the refactor?

## References

### Imported source evidence

1. `/tmp/deployement-demo2.tsx:12-417` for the current preset catalog and embedded phase strings.
2. `/tmp/deployement-demo2.tsx:605-613` for preset switching and runtime reset semantics.
3. `/tmp/deployement-demo2.tsx:621-652` for the current four-phase tick loop.
4. `/tmp/deployement-demo2.tsx:631-640` for the current browser-side dynamic code execution via `new Function(...)`.
5. `/tmp/deployement-demo2.tsx:686-833` for the current generic workbench UI layout.

### Current repository evidence

1. [service.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/system/service.go#L16) for current backend runtime ownership.
2. [controller.go](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/controller/controller.go#L57) for current hardcoded Go reconcile behavior.
3. [App.tsx](/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/App.tsx#L54) for the current pod-specific frontend assumptions.
4. `/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/sources/local/Deployment Demo 2 React Source.tsx` for the ticket-local imported source snapshot.

## Proposed Solution

<!-- Describe the proposed solution in detail -->

## Design Decisions

<!-- Document key design decisions and rationale -->

## Alternatives Considered

<!-- List alternative approaches that were considered and why they were rejected -->

## Implementation Plan

<!-- Outline the steps to implement this design -->

## Open Questions

<!-- List any unresolved questions or concerns -->

## References

<!-- Link to related documents, RFCs, or external resources -->
