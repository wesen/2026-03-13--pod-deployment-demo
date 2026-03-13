---
Title: Go Architecture Review For Scenario Runtime Cleanup
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
      Note: Canonical assembly root reviewed for wiring clarity and helper duplication
    - Path: internal/domain/model.go
      Note: Legacy domain package still defines the shared Event envelope
    - Path: internal/events/hub.go
      Note: Generic event hub currently coupled to the legacy domain package
    - Path: internal/scenario/runtime/session.go
      Note: Core active backend abstraction reviewed for semantics and idiomatic design
    - Path: internal/scenario/runtime/vm.go
      Note: goja host boundary reviewed as a core abstraction
    - Path: internal/scenario/server/handler.go
      Note: Active transport layer reviewed for contract quality and error handling
    - Path: internal/system/service.go
      Note: Legacy pod-demo service identified as duplicated inactive architecture
ExternalSources: []
Summary: ""
LastUpdated: 2026-03-13T18:58:00-04:00
WhatFor: Detailed Go-focused architecture review of the repo with cleanup guidance.
WhenToUse: Use when deciding how to simplify the Go backend, clarify abstractions, and retire duplicated or legacy code.
---


# Go Architecture Review For Scenario Runtime Cleanup

## Executive Summary

The Go side of this repository has one strong architecture hiding inside one confusing repository. The strong architecture is the scenario runtime: presets are loaded from disk, a `Session` owns state and the goja VM, a small HTTP plus WebSocket server exposes the runtime, and the React UI acts as a control room. That core is reasonably elegant. The confusion comes from duplicated entrypoints, a still-present older pod-demo stack, an event type that leaks through the wrong package, and server helpers that fail silently at the transport boundary.

The most important architectural judgment is this: the repo should organize itself around the `internal/scenario` packages and treat the older pod-demo packages as legacy. Right now the code compiles and mostly works, but the repository does not communicate its own abstractions clearly enough. An intern can still spend real time learning the wrong system.

The highest-leverage Go cleanup items are:

- make the active architecture explicit and move or remove the legacy path
- collapse duplicate entrypoints and duplicated helper logic
- decouple the generic event hub from the legacy `internal/domain` package
- make JSON serialization fail loudly
- keep the session abstraction authoritative and semantically consistent

## The Fundamental Abstractions

These are the abstractions that matter in the active system.

### 1. Preset catalog

Where to look:

- `internal/scenario/catalog/catalog.go:19-130`

Role:

- discover scenario directories
- parse metadata, spec, UI schema, and JS phase sources
- expose a stable `ByID` lookup

Assessment:
This is a clear and idiomatic package boundary. It has one job and the implementation matches the job.

### 2. Session

Where to look:

- `internal/scenario/runtime/session.go:35-326`

Role:

- own the active preset and the current goja VM
- hold desired state and published snapshot state
- implement the run/pause/step/reset/preset-switch lifecycle
- publish authoritative state updates

Assessment:
This is the architectural center of the active backend. The abstraction is good. The main problems are semantic edge cases such as `UpdateSpec()` resetting the snapshot view, not the existence of the abstraction itself.

### 3. VM host

Where to look:

- `internal/scenario/runtime/vm.go:14-221`

Role:

- create the goja runtime
- compile phase scripts
- expose host primitives
- execute phase functions and export their results

Assessment:
This is also a good abstraction. It cleanly separates generic lifecycle management in Go from scenario-specific behavior in JavaScript.

### 4. Transport layer

Where to look:

- `internal/scenario/server/handler.go:21-264`
- `internal/events/hub.go:11-58`

Role:

- map session controls to HTTP endpoints
- stream session events over WebSocket

Assessment:
The layering is conceptually right, but the details need cleanup. In particular, the JSON writer should not swallow encode errors, and the event hub should not depend on the legacy domain package for its envelope type.

### 5. App bootstrap

Where to look:

- `internal/app/app.go:20-118`

Role:

- assemble the server from environment/config plus runtime packages

Assessment:
Reasonable as an assembly root, but it still mixes boot wiring with path resolution and environment-specific discovery logic.

## What Is Architecturally Elegant

### The scenario packages are coherent

Problem:
This section is positive. The repo needs to preserve the right things, not just delete the wrong ones.

Where to look:

- `internal/scenario/catalog/catalog.go`
- `internal/scenario/model/model.go`
- `internal/scenario/runtime/session.go`
- `internal/scenario/runtime/vm.go`
- `internal/scenario/server/handler.go`

Example:

```go
cat, err := catalog.Load(scenariosDir)
hub := events.NewHub()
session, err := runtime.NewSession(&first, hub)
handler := scenarioserver.NewHandler(cat, session, hub)
```

Why it matters:
The package seams align with the actual runtime responsibilities. This is the backbone worth keeping.

Cleanup sketch:

```text
internal/scenario/
  catalog/
  model/
  runtime/
  server/
```

Keep this structure central and document it as the active architecture.

### The code is mostly idiomatic in its concurrency model

Problem:
Again, positive. The concurrency model is lightweight and understandable.

Where to look:

- `internal/scenario/runtime/session.go:216-290`
- `internal/events/hub.go:23-57`
- `internal/worker/manager.go:28-65`
- `internal/worker/worker.go:22-61`

Example:

```go
ctx, cancel := context.WithCancel(context.Background())
s.cancel = cancel
s.running = true
go s.loop(ctx)
```

Why it matters:
The runtime uses `context`, goroutines, and channels in a way that is easy to reason about. There is no gratuitous concurrency framework.

Cleanup sketch:
Preserve this style. The cleanup target is architecture clarity, not a concurrency rewrite.

## Architectural Findings

### 1. The repo contains two backends, but only one is active

Problem:
The active runtime lives under `internal/scenario`, but the old pod-demo stack still exists under `internal/server`, `internal/system`, `internal/controller`, `internal/state`, `internal/worker`, and `internal/domain`. Since both stacks are in the same tree and some names are generic, the active architecture is harder to see than it should be.

Where to look:

- active stack: `internal/scenario/*`, `internal/app/app.go`
- legacy stack: `internal/server/handler.go`, `internal/system/service.go`, `internal/controller/controller.go`, `internal/state/store.go`, `internal/worker/*`, `internal/domain/model.go`

Example:

```go
// Active
handler := scenarioserver.NewHandler(cat, session, hub)

// Legacy
func NewHandler(service *system.Service) http.Handler { ... }
```

Why it matters:

- onboarding is slower
- architectural reasoning becomes noisier
- cleanup decisions are harder because the repo still looks bi-modal

Cleanup sketch:

```text
Option A:
  internal/legacy/poddemo/
    controller/
    domain/
    server/
    state/
    system/
    worker/

Option B:
  delete the legacy tree once no tests/docs depend on it
```

### 2. The event envelope lives in the wrong package

Problem:
`internal/events/hub.go` depends on `internal/domain.Event`, even though `internal/domain` is otherwise the legacy pod-demo model package. The generic event bus is therefore coupled to a package that semantically belongs to the deprecated architecture.

Where to look:

- `internal/events/hub.go:8-15`
- `internal/domain/model.go:54-58`

Example:

```go
import "github.com/manuel/wesen/pod-deployment-demo/internal/domain"

type Hub struct {
    subscribers map[uint64]chan domain.Event
}
```

Why it matters:

- it makes the old domain package look more central than it should be
- it blurs the fundamental abstraction of the active system
- it makes later removal of legacy code harder

Cleanup sketch:

```go
// internal/events/event.go
package events

type Event struct {
    Type    string `json:"type"`
    TS      string `json:"ts"`
    Payload any    `json:"payload"`
}
```

Then update `Hub` and callers to use `events.Event`.

### 3. Two binaries with the same body are unnecessary duplication

Problem:
`cmd/pod-demo/main.go` and `cmd/scenario-demo/main.go` are identical.

Where to look:

- `cmd/pod-demo/main.go:13-24`
- `cmd/scenario-demo/main.go:13-24`

Example:

```go
application, err := app.New()
if err != nil {
    log.Fatal(err)
}
if err := application.Run(ctx); err != nil {
    log.Fatal(err)
}
```

Why it matters:

- two names suggest two modes
- docs and scripts have to choose arbitrarily
- future behavior drift becomes possible

Cleanup sketch:

```text
Choose one canonical binary name.
Keep the other only as a temporary alias or delete it.
```

### 4. Bootstrap and path resolution are mixed, and helper logic is duplicated

Problem:
`internal/app/app.go` acts as the assembly root, but it also owns repo-root discovery. `internal/web/generate_build.go` contains a second copy of that same discovery logic.

Where to look:

- `internal/app/app.go:24-59`
- `internal/app/app.go:87-118`
- `internal/web/generate_build.go:14-25`
- `internal/web/generate_build.go:61-78`

Example:

```go
func findRepoRoot() (string, error) {
    dir, err := os.Getwd()
    ...
}
```

Why it matters:

- duplicate logic creates drift
- config/path rules become harder to test
- the assembly root becomes less declarative

Cleanup sketch:

```text
internal/app/
  app.go      // wiring only
  config.go   // env/config loading
  paths.go    // repo root + scenarios dir resolution
```

### 5. JSON serialization is not handled robustly

Problem:
Both HTTP server packages ignore JSON encoding errors. This is not just a code smell; it caused live `200 OK` empty-body failures once a `NaN` entered the snapshot.

Where to look:

- `internal/scenario/server/handler.go:248-251`
- `internal/server/handler.go:167-170`

Example:

```go
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(code)
_ = json.NewEncoder(w).Encode(payload)
```

Why it matters:

- silent corruption at the transport boundary
- confusing frontend failures
- tests that only assert status codes miss the real breakage

Cleanup sketch:

```go
func writeJSON(w http.ResponseWriter, code int, payload any) {
    data, err := json.Marshal(payload)
    if err != nil {
        http.Error(w, fmt.Sprintf("encode json: %v", err), http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    _, _ = w.Write(append(data, '\n'))
}
```

### 6. `Session.UpdateSpec()` violates the session abstraction

Problem:
The `Session` abstraction should make state transitions semantically clear. Right now, changing desired state is implemented as if it were a fresh empty snapshot, which breaks the meaning of the published state.

Where to look:

- `internal/scenario/runtime/session.go:177-185`
- `internal/scenario/runtime/session.go:301-314`

Example:

```go
s.desired = deepCopyMap(spec)
s.last = s.buildSnapshot()
```

Why it matters:

- the session contract becomes surprising
- the UI appears to reset even though the VM was not rebuilt
- downstream logic cannot trust snapshot semantics

Cleanup sketch:

```go
s.desired = deepCopyMap(spec)
s.last.Desired = deepCopyMap(s.desired)
// preserve actual/diff/actions/logs unless a real reset happens
```

### 7. Tests are better at package-level behavior than live contract behavior

Problem:
There is decent package coverage, but some tests stop at status-code checks or single-step behavior and therefore miss live multi-step encoding failures.

Where to look:

- `internal/app/app_test.go:9-28`
- `internal/scenario/server/handler_test.go:61-80`
- `internal/scenario/runtime/session_test.go`

Example:

```go
if rec.Code != http.StatusOK {
    t.Fatalf("expected scenario snapshot endpoint to respond 200, got %d", rec.Code)
}
```

Why it matters:

- status-only checks miss empty-body responses
- one-step tests miss scenario-state bugs like the `zombie-fleet` `NaN`

Cleanup sketch:

```go
body := rec.Body.Bytes()
if len(body) == 0 {
    t.Fatal("expected non-empty json body")
}
if !json.Valid(body) {
    t.Fatal("expected valid json")
}
```

Then add multi-step scenario regression coverage.

### 8. The Go tree mixes source of truth with generated noise

Problem:
`internal/web/embed/public` contains committed generated frontend assets. That is operationally fine for embed builds, but it adds noise to the Go tree and makes architecture review harder because source and generated artifacts live close together.

Where to look:

- `internal/web/embed/public/*`
- `internal/web/generate.go:1-3`
- `internal/web/generate_build.go:14-98`

Why it matters:

- review diffs are noisier
- source discovery is slower
- the frontend build story is not obviously connected to the Go server story

Cleanup sketch:

```text
Keep generated assets if the single-binary workflow requires them,
but document them clearly and consider reducing churn via a dedicated build script.
```

### 9. The legacy worker/controller stack is reasonably idiomatic, but no longer belongs in the active conceptual path

Problem:
The older worker/controller code is not bad Go. The real issue is that it is still colocated with the active system and uses generic package names like `state`, `worker`, and `controller`.

Where to look:

- `internal/controller/controller.go:16-122`
- `internal/state/store.go:13-272`
- `internal/worker/manager.go:9-65`
- `internal/worker/worker.go:8-62`

Why it matters:

- generic package names imply centrality
- readers cannot tell quickly which code is active

Cleanup sketch:

```text
Move legacy code under a clearly named subtree or remove it.
Do not leave generic package names attached to inactive architecture.
```

## Consistency Review

### What is consistent

- The active scenario packages use clear nouns and responsibilities.
- The code generally favors small structs and explicit methods over clever indirection.
- `context` and goroutines are used in a straightforward way.

### What is inconsistent

- active and legacy architectures coexist without clear separation
- package manager expectations differ between the Go embed builder and the desired frontend dev workflow
- event modeling crosses package boundaries awkwardly
- server transport helpers are duplicated and equally flawed

## Idiomatic Go Review

Mostly idiomatic:

- package-oriented design over class-like over-abstraction
- use of `context.Context` for lifecycle control
- use of `http.Handler` and `http.ServeMux`
- use of `sync.Mutex` and channels directly

Less idiomatic or weaker than it should be:

- swallowing encode errors at the HTTP boundary
- duplicating helper functions instead of extracting shared helpers
- retaining generic package names for non-canonical legacy code
- relying on JSON deep copies as the default state-copy mechanism without a clearly named helper package or comment explaining the tradeoff

The JSON deep copy in `internal/scenario/runtime/session.go:328-332` is acceptable for a small generic prototype, but it should be treated as an explicit tradeoff, not an invisible convenience.

## Recommended Target Organization

```text
cmd/
  scenario-demo/

internal/
  app/
    app.go
    config.go
    paths.go
  events/
    event.go
    hub.go
  scenario/
    catalog/
    model/
    runtime/
    server/
  web/
    embed.go
    generate.go
    generate_build.go
    spa.go

internal/legacy/           # only if legacy code is kept
  poddemo/
    controller/
    domain/
    server/
    state/
    system/
    worker/
```

## Proposed Solution

The cleanest path is not a rewrite. It is a clarification:

1. Declare the scenario runtime as the canonical architecture.
2. Move or delete the old pod-demo stack.
3. Decouple the event envelope from the legacy domain package.
4. Merge duplicated entrypoints and shared helpers.
5. Fix transport error handling.
6. Tighten tests around real JSON contracts and multi-step runtime behavior.

## Design Decisions

### Decision: review the codebase around active abstractions first, not package count

Rationale:
The repo does not mainly suffer from too many files. It suffers from too many equally plausible stories about what the backend is.

### Decision: preserve small-package design

Rationale:
The active scenario backend is already closer to good Go style than a large service package would be. Cleanup should sharpen those seams, not flatten them.

### Decision: treat legacy code as an organizational problem, not a moral failure

Rationale:
The older controller/worker code is understandable. It is just no longer the repo’s main architecture.

## Alternatives Considered

### Merge everything into one `internal/runtime` package

Rejected.

Reason:
That would reduce package count while making responsibilities less clear.

### Leave the code as-is and rely on docs only

Rejected.

Reason:
The naming and package coupling problems are in the code layout itself, not only in missing prose.

### Rewrite the backend around a heavier framework

Rejected.

Reason:
The current Go backend is already close to the right complexity level. The problems are clarity, duplication, and a few leaky boundaries.

## Implementation Plan

### Phase 1: Clarify the active architecture

1. Pick the canonical binary name.
2. Move or mark legacy packages.
3. Update docs and dev scripts accordingly.

### Phase 2: Clean the shared infrastructure

1. Move `Event` out of `internal/domain`.
2. Extract shared config/path helpers.
3. Fix JSON writing semantics.

### Phase 3: Tighten runtime semantics

1. Fix `UpdateSpec()` snapshot behavior.
2. Add runtime boundary validation for JSON-unsafe values where appropriate.
3. Expand integration-style tests.

### Phase 4: Reduce build and generated-asset ambiguity

1. Standardize frontend package management.
2. Make the embed build pipeline reflect that choice.
3. Document generated assets clearly.

## Open Questions

1. Is the old pod-demo stack still intentionally kept as a teaching/reference artifact?
2. Should the repo keep a compatibility binary alias for a transition period?
3. Does the team want the event stream to stay generic, or should scenario transport move closer to snapshot-first semantics?

## References

- `cmd/pod-demo/main.go:13-24`
- `cmd/scenario-demo/main.go:13-24`
- `internal/app/app.go:24-118`
- `internal/app/app_test.go:9-28`
- `internal/events/hub.go:11-58`
- `internal/domain/model.go:45-58`
- `internal/scenario/catalog/catalog.go:19-130`
- `internal/scenario/runtime/session.go:35-332`
- `internal/scenario/runtime/vm.go:14-221`
- `internal/scenario/server/handler.go:21-264`
- `internal/server/handler.go:21-188`
- `internal/system/service.go:16-146`
- `internal/controller/controller.go:16-122`
- `internal/state/store.go:13-272`
- `internal/worker/manager.go:9-65`
- `internal/worker/worker.go:8-62`
- `internal/web/generate_build.go:14-98`
- `internal/web/spa.go:11-46`
