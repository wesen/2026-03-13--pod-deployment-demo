---
Title: "Intern Guide to the Scenario Runtime"
Slug: "intern-guide-to-scenario-runtime"
Short: "A detailed system guide for interns covering architecture, runtime flow, JavaScript sandboxes, API surfaces, and debugging paths."
Topics:
- scenario-runtime
- reconciliation
- backend
- frontend
- javascript
Commands:
- serve
- help
IsTopLevel: true
IsTemplate: false
ShowPerDefault: true
SectionType: Tutorial
Order: 15
---

This guide is the long-form onboarding document for an intern who needs to understand the system well enough to make careful changes. Read it as a map of the project rather than as a changelog. The goal is to explain what the system is, why it is shaped this way, where the important boundaries are, and how to reason about behavior when something goes wrong.

The most important idea to keep in your head while reading is this: the project is a generic scenario runtime. Go owns the lifecycle and transport. JavaScript owns scenario-specific behavior. React owns presentation. If you preserve that split, the system stays understandable. If you blur it, the codebase starts accumulating ad hoc rules quickly.

## What Problem This System Solves

This section covers the product idea and why the code is organized around it.

Many controller-style systems are hard to teach and hard to debug because the interesting logic disappears inside one opaque "reconcile" call. This project breaks that opaque controller into four visible stages:

1. observe the world,
2. compare the world to desired state,
3. plan a response,
4. execute the response.

That is the core experience exposed in the browser. The workbench is not meant to be a magical client that figures things out on its own. It is a viewer and operator console for a backend-authored reconciliation loop.

From a product perspective, the system lets you do three useful things:

- simulate scenario-specific control logic without changing the Go runtime,
- inspect the state of the loop at every tick,
- debug whether a problem is in observation, comparison, planning, or execution.

## System At A Glance

This section gives you the high-level picture before diving into packages.

```text
             +-----------------------------+
             |        React Workbench      |
             | ui/                         |
             | - preset picker             |
             | - desired-state editor      |
             | - data panels               |
             | - log viewer                |
             +-------------+---------------+
                           |
                           | HTTP + WebSocket
                           v
             +-----------------------------+
             |      Go HTTP Server         |
             | internal/scenario/server    |
             | - /api/*                    |
             | - /ws                       |
             | - SPA handler               |
             +-------------+---------------+
                           |
                           v
             +-----------------------------+
             |     Session / Runtime       |
             | internal/scenario/runtime   |
             | - current preset            |
             | - desired state             |
             | - tick loop                 |
             | - snapshots                 |
             +-------------+---------------+
                           |
                           v
             +-----------------------------+
             |        Goja Sandbox         |
             | observe / compare / plan /  |
             | execute per preset          |
             +-------------+---------------+
                           |
                           v
             +-----------------------------+
             |     scenarios/<preset>/     |
             | - scenario.json             |
             | - spec.json                 |
             | - ui.json                   |
             | - *.js stage files          |
             +-----------------------------+
```

If you remember nothing else, remember this diagram. It captures the real dependency direction of the project.

## The Repository Layout

This section covers the files and packages you should know before editing anything.

Important entrypoints and packages:

- `cmd/scenario-demo/main.go`
  Starts the Cobra-based CLI and embedded help system.
- `internal/cli/root.go`
  Defines the `serve` command and wires Glazed help pages into the CLI.
- `internal/app/app.go`
  Assembles the server from config, catalog, runtime, and transport pieces.
- `internal/app/config.go`
  Loads `ADDR` and `SCENARIOS_DIR`.
- `internal/scenario/catalog/catalog.go`
  Loads preset directories from disk and validates the required files.
- `internal/scenario/runtime/session.go`
  Holds the authoritative backend state machine.
- `internal/scenario/runtime/vm.go`
  Builds and executes the Goja sandbox for the active preset.
- `internal/scenario/server/handler.go`
  Exposes the JSON API and WebSocket stream.
- `internal/web/`
  Serves the embedded frontend bundle and SPA fallback behavior.
- `ui/src/scenario/`
  Holds the React-side session hook, reducer, API client, types, and workbench components.
- `scenarios/`
  Contains the preset packages the runtime can load.

The embedded help pages in `internal/doc/` are now the canonical docs. If you update the architecture or API behavior, update these pages instead of reviving a separate pile of ad hoc markdown somewhere else.

## How Startup Works

This section covers what happens when you run the binary.

When you run:

```bash
go run ./cmd/scenario-demo serve
```

the following sequence happens:

```text
main()
  -> cli.Execute(ctx)
    -> NewRootCommand()
      -> load embedded docs
      -> define Cobra command
    -> run "serve"
      -> app.LoadConfig()
      -> app.NewWithConfig(cfg)
        -> catalog.Load(cfg.ScenariosDir)
        -> runtime.NewSession(firstPreset, hub)
        -> server.NewHandler(catalog, session, hub)
      -> http.Server.ListenAndServe()
```

Pseudocode version:

```text
config = readEnvAndFlags()
catalog = loadPresetPackages(config.scenariosDir)
session = createRuntimeSession(catalog.firstPreset)
handler = buildHTTPHandler(catalog, session)
serve(handler, config.addr)
```

This startup order matters. The server should only begin listening after the preset catalog and initial runtime session are valid. Otherwise the browser would connect to a half-initialized application.

## What A Preset Actually Is

This section covers the contract between the runtime and each scenario.

Every preset is one folder under `scenarios/` with these files:

```text
scenarios/<id>/
  scenario.json
  spec.json
  ui.json
  observe.js
  compare.js
  plan.js
  execute.js
```

Each file has a distinct job:

- `scenario.json`
  Declares metadata such as the stable ID, name, description, icon, and initial tick timing.
- `spec.json`
  Defines the initial desired state for the scenario.
- `ui.json`
  Defines the controls that the React workbench renders to let users edit the desired state.
- `observe.js`
  Computes the current actual world.
- `compare.js`
  Computes drift between desired and actual.
- `plan.js`
  Emits a list of corrective actions.
- `execute.js`
  Applies the actions using sandbox-local state and logs.

The catalog loader in `internal/scenario/catalog/catalog.go` does not care what the scenario means. It only cares that the package is structurally complete and parseable.

## The Reconciliation Loop, Step By Step

This section is the heart of the document.

The runtime loop is implemented in `internal/scenario/runtime/session.go`. On each tick, the session:

1. deep-copies the desired state,
2. calls `observe`,
3. calls `compare`,
4. calls `plan`,
5. calls `execute`,
6. flushes logs from the VM,
7. builds a new snapshot,
8. publishes the snapshot to listeners.

Pseudocode:

```text
desired = deepCopy(currentDesired)

phase = "observe"
actual = vm.observe(desired)

phase = "compare"
diff = vm.compare(desired, actual)

phase = "plan"
actions = vm.plan(desired, actual, diff)

phase = "execute"
vm.execute(desired, actual, diff, actions)

logs = vm.flushLogs()
tick += 1
phase = "idle"

snapshot = {
  desired,
  actual,
  diff,
  actions,
  logs,
  tick,
  running,
  speedMs,
}

publish("snapshot.updated", snapshot)
```

This is a good place to pause and notice what the Go runtime does not do. It does not interpret the meaning of the scenario. It does not know what a truck, pod, or zombie is. It only knows the sequencing contract.

## Why The JavaScript Sandbox Exists

This section covers the deepest architectural boundary in the project.

The JavaScript sandbox exists to hide scenario-specific implementation detail without hiding the behavior of the reconciliation envelope. That distinction is subtle but critical.

We want to hide:

- how one scenario defines "healthy",
- how another scenario models drift,
- how a scenario keeps its own internal counters or random simulation state,
- how one domain chooses to express actions.

We do not want to hide:

- what phase is currently running,
- what desired state the loop is using,
- what actual state was observed,
- what drift was detected,
- what actions were planned,
- what logs the execution stage emitted.

That is why the sandbox API in `internal/scenario/runtime/vm.go` is deliberately tiny. The host registers:

- `getState(key)`
- `setState(key, value)`
- `log(message)`
- `randomFloat(min, max)`
- `randomInt(min, max)`
- `round(value, decimals)`

There is no general-purpose filesystem API, no transport access, and no direct handle into Go session internals. That is not a limitation to work around. It is the mechanism that keeps the architecture clean.

## Session State And Why The Backend Owns It

This section covers what the frontend can ask for versus what it can decide.

`runtime.Session` is the authoritative mutable state for one active preset. It owns:

- the active preset,
- the VM,
- the desired state,
- the current phase,
- the tick counter,
- the latest snapshot,
- the full log history,
- the running flag,
- the playback speed.

The frontend never becomes the source of truth for any of that. It can call endpoints such as:

- run,
- pause,
- step,
- reset,
- update desired spec,
- switch preset,
- change speed.

But the browser is always issuing requests against a backend-owned state machine. This is why snapshot debugging is so effective in this project. If the snapshot is wrong, the backend is wrong. If the snapshot is right and the browser is wrong, the frontend is wrong.

## HTTP And WebSocket API Reference

This section covers the transport surface you will use for debugging and testing.

The handler in `internal/scenario/server/handler.go` exposes these routes:

- `GET /api/healthz`
  Liveness check.
- `GET /api/presets`
  List preset metadata.
- `GET /api/presets/{id}/ui`
  Return the UI schema for one preset.
- `POST /api/session/preset`
  Switch the active preset.
- `POST /api/session/run`
  Start automatic ticking.
- `POST /api/session/pause`
  Stop automatic ticking.
- `POST /api/session/step`
  Run one tick.
- `POST /api/session/reset`
  Rebuild the VM and reset session state.
- `GET /api/session/spec`
  Read the current desired spec.
- `PUT /api/session/spec`
  Replace the desired spec.
- `POST /api/session/speed`
  Set the tick interval.
- `GET /api/session/snapshot`
  Read the latest full session snapshot.
- `GET /ws`
  Subscribe to live event updates.

Representative payloads:

```json
POST /api/session/preset
{
  "presetId": "taco-fleet"
}
```

```json
POST /api/session/speed
{
  "speedMs": 400
}
```

```json
PUT /api/session/spec
{
  "replicas": 5,
  "region": "us-east-1"
}
```

Representative WebSocket event shape:

```json
{
  "type": "snapshot.updated",
  "ts": "2026-03-14T00:00:00Z",
  "payload": {
    "tick": 3,
    "phase": "idle",
    "desired": {},
    "actual": {},
    "diff": {},
    "actions": [],
    "logs": [],
    "allLogs": [],
    "running": false,
    "speedMs": 1000
  }
}
```

When debugging transport bugs, do not start in the browser. Start with `/api/session/snapshot`. It gives you the ground truth in the smallest possible surface area.

## The Frontend Data Flow

This section covers how the React side consumes backend state.

The React workbench does not run scenario logic. It does three simpler things:

- fetch the initial snapshot,
- open a WebSocket and decode server events,
- reduce those events into the current view model.

The most relevant files are:

- `ui/src/scenario/api.ts`
  HTTP request helpers.
- `ui/src/scenario/useScenarioSession.ts`
  Session lifecycle, initial fetch, WebSocket setup, mutation helpers.
- `ui/src/scenario/reducer.ts`
  Server event decoding and snapshot reduction logic.
- `ui/src/scenario/components/`
  Workbench views and panels.

Pseudocode:

```text
onMount:
  snapshot = fetchSnapshot()
  render(snapshot)
  socket = openWebSocket()

onSocketMessage:
  event = decode(eventPayload)
  snapshot = reduce(snapshot, event)
  render(snapshot)
```

This design keeps the frontend narrow. It is mostly a state projection layer over backend data.

## How To Debug The System

This section covers the order of operations that will save you time.

When something looks wrong:

1. Identify whether the issue is startup, transport, runtime, preset logic, or rendering.
2. Fetch `/api/session/snapshot`.
3. Check the current phase and output panels.
4. Narrow the bug to one stage if possible.
5. Only after that open the relevant source file.

Good debugging questions:

- Is the preset loading at all?
- Is the desired state what I think it is?
- Is `observe` returning nonsense?
- Is `compare` defining drift incorrectly?
- Is `plan` producing unusable actions?
- Is `execute` mutating sandbox state in a surprising way?
- Is the backend snapshot correct but the UI stale?

Stage-based debugging map:

```text
wrong actual  -> inspect observe.js
wrong diff    -> inspect compare.js
wrong actions -> inspect plan.js
wrong effects -> inspect execute.js
wrong panel but correct snapshot -> inspect frontend reducer/rendering
```

## Common Mistakes New Contributors Make

This section covers the traps that are most likely to waste intern time.

- Adding scenario-specific conditionals in Go.
  This usually means logic escaped the sandbox.
- Treating the frontend as an authority on state.
  It is a renderer and operator surface, not the source of truth.
- Making `compare.js` too weak.
  A thin diff usually forces awkward plan logic and poor operator visibility.
- Hiding too much in `execute.js` without enough logging.
  Hidden mechanics are fine, invisible consequences are not.
- Debugging only from the browser.
  The snapshot endpoint is almost always the faster path to clarity.

## Reading Order For Source Code

This section covers how an intern should explore the codebase without getting lost.

Recommended order:

1. `internal/scenario/model/model.go`
   Learn the data structures.
2. `internal/scenario/catalog/catalog.go`
   Learn how presets are loaded.
3. `internal/scenario/runtime/vm.go`
   Learn the sandbox boundary.
4. `internal/scenario/runtime/session.go`
   Learn the loop and state machine.
5. `internal/scenario/server/handler.go`
   Learn the transport layer.
6. `ui/src/scenario/useScenarioSession.ts`
   Learn how the frontend attaches to backend state.
7. `ui/src/scenario/reducer.ts`
   Learn how live events become current UI state.

If you follow this order, the code will feel designed. If you jump straight into UI components or stage scripts, it can look more arbitrary than it really is.

## Mini Glossary

This section defines the terms that appear repeatedly across the code and docs.

- desired state
  The target configuration being reconciled.
- actual state
  The world as observed by the scenario.
- diff
  A structured representation of drift between desired and actual.
- action
  A planned corrective step emitted by `plan.js`.
- snapshot
  The backend-authored state payload rendered by the frontend.
- preset
  One self-contained scenario package under `scenarios/`.
- sandbox
  The Goja runtime that executes the four stage files plus the tiny host API.

## Suggested First Tasks For An Intern

This section turns the theory into a practical starting point.

- Add a small preset and keep all logic inside the JS stage files.
- Trace one existing preset from `spec.json` through one manual `Step`.
- Add one new field to the snapshot or UI schema and follow it end to end.
- Write one test in `internal/doc/doc_test.go` or in the runtime/catalog packages after reading the loop.

Those tasks are small enough to be safe and large enough to force real understanding.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| The architecture feels abstract | You are reading prose without grounding it in one preset | Open one preset folder and trace it through one manual step in the UI |
| The frontend seems more complicated than the backend | You started from components instead of the session and transport model | Restart with `session.go`, then `handler.go`, then `useScenarioSession.ts` |
| It is unclear where to add a new rule | The Go/JS boundary is still fuzzy | Ask whether the rule is generic runtime machinery or scenario meaning |
| The sandbox feels too restrictive | You are trying to treat it like a plugin platform | Reframe it as a scenario logic container, not as a general extension runtime |

## See Also

- `scenario-demo help pod-deployment-demo`
- `scenario-demo help runtime-architecture`
- `scenario-demo help reconciliation-loop-reference`
- `scenario-demo help authoring-scenarios`
- `scenario-demo help operating-the-demo`
