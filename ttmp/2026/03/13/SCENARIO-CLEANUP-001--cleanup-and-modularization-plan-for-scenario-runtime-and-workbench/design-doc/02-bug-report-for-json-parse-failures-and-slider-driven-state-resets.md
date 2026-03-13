---
Title: Bug Report For JSON Parse Failures And Slider Driven State Resets
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
    - Path: internal/scenario/runtime/session.go
      Note: Backend snapshot semantics and UpdateSpec behavior
    - Path: internal/scenario/server/handler.go
      Note: Silent JSON encoding failure path at the HTTP and WebSocket boundary
    - Path: scenarios/zombie-fleet/observe.js
      Note: Scenario-specific NaN source causing empty snapshot responses
    - Path: ttmp/2026/03/13/SCENARIO-CLEANUP-001--cleanup-and-modularization-plan-for-scenario-runtime-and-workbench/scripts/inspect_snapshot.go
      Note: Ticket-local reproduction helper used to confirm marshal failure
    - Path: ui/src/ScenarioApp.tsx
      Note: Frontend parse path and spec update calls implicated in the reported failures
ExternalSources: []
Summary: ""
LastUpdated: 2026-03-13T18:58:00-04:00
WhatFor: Focused defect report for live JSON parse failures and slider-triggered state resets in the scenario workbench.
WhenToUse: Use when fixing the current runtime/UI breakage before or alongside broader cleanup work.
---


# Bug Report For JSON Parse Failures And Slider Driven State Resets

## Executive Summary

The earlier cleanup guide did not specifically address the two failures reported from live usage. After reproducing them, the result is clear: there are two separate bugs, and they live at different layers.

The first bug is a backend-to-frontend contract failure that surfaces as `JSON.parse` errors in the browser. In the live app, `ScenarioApp` tries to parse WebSocket frames and HTTP JSON responses, but the backend can currently return `200 OK` with an empty body when snapshot encoding fails. The immediate reproducible cause is in the `zombie-fleet` scenario: after the second tick, a `NaN` enters the snapshot payload, JSON encoding fails, and the server silently emits an empty response because `writeJSON` ignores encoder errors.

The second bug is a snapshot semantics bug. Every time the UI changes a desired-state slider, `Session.UpdateSpec()` rebuilds the published snapshot from `buildSnapshot()`, which clears `actual`, `diff`, `actions`, and `logs`. The VM is not necessarily reset, but the authoritative snapshot sent to the UI is effectively reset, so the interface appears to lose state on every slider movement.

These issues need targeted fixes before the larger cleanup plan is considered complete.

## Problem Statement

Reported symptoms:

1. Browser console repeatedly shows:

```text
Uncaught SyntaxError: JSON.parse: unexpected end of data at line 1 column 1 of the JSON data
```

2. Moving a slider in the UI causes the visible state to reset.

These symptoms are especially dangerous because they make the runtime appear unstable even when the underlying architecture is mostly sound. They also create false debugging trails: the parse error looks like a frontend parser problem, but the actual failure begins in backend snapshot encoding.

## Reproduction

### Reproduction 1: Empty snapshot body and parse failure

Where to look:

- `ui/src/ScenarioApp.tsx:661-691`
- `internal/scenario/server/handler.go:219-251`
- `internal/scenario/runtime/session.go:317-326`
- `scenarios/zombie-fleet/observe.js:1-98`

Observed browser behavior:

- opening the workbench produced `SyntaxError: Unexpected end of JSON input`
- Playwright observed a WebSocket message with `data === ""`
- the socket then closed with code `1006`

Observed live HTTP behavior:

```text
GET /api/session/snapshot
HTTP/1.1 200 OK
Content-Length: 0
```

Fresh-session reproduction on a clean port:

1. Start a fresh server on `:3101`.
2. Switch to `zombie-fleet`.
3. Step once: response body is valid JSON.
4. Step twice: response body becomes empty.

Empirical evidence:

```text
preset zombie-fleet switch 200 1022
spec zombie-fleet 200 977
step zombie-fleet 1 200 1648
step zombie-fleet 2 200 0
snapshot zombie-fleet 200 0
```

Direct marshal inspection from `scripts/inspect_snapshot.go` showed:

```text
snapshot 2 marshal err: json: unsupported value: NaN
snapshot 2 payload len: 0
```

### Reproduction 2: Slider-driven reset

Where to look:

- `ui/src/ScenarioApp.tsx:768-783`
- `internal/scenario/runtime/session.go:177-185`
- `internal/scenario/runtime/session.go:301-314`

Reproduction:

1. Load a running or stepped scenario.
2. Move any desired-state slider.
3. The `PUT /api/session/spec` response returns a snapshot with the desired state updated, but `actual`, `diff`, `actions`, and `logs` are reset to their build-time defaults.

This is not a UI-only illusion. It is the snapshot contract returned by the backend.

## Root Cause Analysis

### Root Cause A: `zombie-fleet` creates `NaN`, then the server silently emits an empty JSON response

Problem:
`scenarios/zombie-fleet/observe.js` uses truthy fallback defaults like `current.walls || 1`. When `current.walls` is legitimately `0`, the code incorrectly revives it to `1`, but `current.wallHp` remains an empty array. On the next tick, the scenario executes `actual.wallHp[topWall] -= surviving * 8` against `undefined`, producing `NaN`.

Where to look:

- `scenarios/zombie-fleet/observe.js:2-11`
- `scenarios/zombie-fleet/observe.js:46-55`
- `internal/scenario/server/handler.go:248-251`

Example:

```js
const actual = current ? {
  walls: current.walls || 1,
  wallHp: (current.wallHp || []).map((hp) => hp),
  ...
} : { ... };

const topWall = actual.walls - 1;
actual.wallHp[topWall] -= surviving * 8;
```

Why it matters:

- `NaN` is not valid JSON.
- `json.NewEncoder(w).Encode(payload)` fails.
- `writeJSON` ignores that error and still returns `200 OK`.
- the frontend receives an empty body and fails in `Response.json()` or `JSON.parse(msg.data)`.

Cleanup sketch:

```js
const actual = current ? {
  walls: current.walls !== undefined ? current.walls : 1,
  wallHp: Array.isArray(current.wallHp) ? current.wallHp.map((hp) => hp) : [100],
  ...
} : initialState();

if (surviving > 0 && actual.walls > 0 && actual.wallHp.length >= actual.walls) {
  const topWall = actual.walls - 1;
  actual.wallHp[topWall] = (actual.wallHp[topWall] ?? 100) - surviving * 8;
}
```

### Root Cause B: snapshot writing is not fail-closed

Problem:
Both scenario and legacy servers call `writeJSON`, which writes headers and ignores JSON encoding failures.

Where to look:

- `internal/scenario/server/handler.go:248-251`
- `internal/server/handler.go:167-170`

Example:

```go
func writeJSON(w http.ResponseWriter, code int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(payload)
}
```

Why it matters:

- encoding bugs become silent transport corruption
- clients get `200 OK` with empty bodies
- debugging shifts to the wrong layer

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

### Root Cause C: `UpdateSpec()` rebuilds a blank snapshot instead of preserving current runtime state

Problem:
`Session.UpdateSpec()` currently throws away the current published `actual`, `diff`, `actions`, and `logs` view by calling `buildSnapshot()`.

Where to look:

- `internal/scenario/runtime/session.go:177-185`
- `internal/scenario/runtime/session.go:301-314`

Example:

```go
func (s *Session) UpdateSpec(spec map[string]any) SessionState {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.desired = deepCopyMap(spec)
	s.last = s.buildSnapshot()
	s.publishStateLocked("snapshot.updated")
	return s.currentStateLocked()
}
```

Why it matters:

- the authoritative snapshot appears reset after every slider move
- the UI cannot distinguish "desired changed" from "session reset"
- logs and action context disappear even when the VM has not been rebuilt

Cleanup sketch:

```go
func (s *Session) UpdateSpec(spec map[string]any) SessionState {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.desired = deepCopyMap(spec)
	s.last.Desired = deepCopyMap(s.desired)
	s.publishStateLocked("snapshot.updated")
	return s.currentStateLocked()
}
```

If a full recomputation is desired on spec change, do it explicitly and keep the semantics distinct from reset.

### Root Cause D: the frontend parser is too trusting

Problem:
The frontend assumes every WebSocket frame contains valid JSON text and every snapshot fetch returns a valid JSON body.

Where to look:

- `ui/src/ScenarioApp.tsx:661-691`

Example:

```ts
const event = JSON.parse(msg.data) as ServerEvent;
setSnapshot((cur) => reduceEvent(cur, event));
```

Why it matters:

- a backend transport failure instantly becomes a noisy client exception loop
- the UI does not surface a clear operator-facing error

Cleanup sketch:

```ts
socket.addEventListener("message", (msg) => {
  if (!active) return;
  if (typeof msg.data !== "string" || msg.data.trim() === "") {
    setError("empty websocket message from server");
    return;
  }
  try {
    const event = JSON.parse(msg.data) as ServerEvent;
    setSnapshot((cur) => reduceEvent(cur, event));
  } catch (err) {
    setError(err instanceof Error ? err.message : "invalid websocket json");
  }
});
```

This is defensive hardening, not the primary fix.

## Proposed Solution

Apply the fixes in this order:

1. Fix `zombie-fleet` state initialization and zero-value handling.
2. Make backend JSON writing fail loudly instead of silently returning empty `200` responses.
3. Change `UpdateSpec()` so desired-state edits preserve the current runtime snapshot unless an explicit reset is requested.
4. Add frontend guards around empty or invalid WebSocket payloads.
5. Add regression tests that cover real multi-step preset behavior and non-empty HTTP response bodies.

## Design Decisions

### Decision: treat the empty JSON body as a backend bug first

Rationale:
The frontend stack trace is real, but the transport contract is already broken before the browser touches `JSON.parse`.

### Decision: preserve runtime state on spec edits

Rationale:
Changing desired state is not the same thing as resetting the session. The snapshot contract should reflect that semantic difference.

### Decision: keep scenario-specific fixes local, but improve the host boundary too

Rationale:
The `zombie-fleet` bug is local, but the silent encode failure is systemic. Both layers need repair.

## Alternatives Considered

### Only patch the frontend parser

Rejected.

Reason:
That would hide a corrupted server response without fixing the source of the corruption.

### Reset the VM on every spec change

Rejected.

Reason:
That would make the system behavior more predictable in one narrow sense, but it would also make sliders destructive and would break the interactive-control model.

### Leave `writeJSON` as-is and rely on tests

Rejected.

Reason:
The current implementation already produced silent `200 OK` failures in a live run. The transport path needs hard failure semantics.

## Implementation Plan

### Phase 1: Contain the transport corruption

1. Fix `writeJSON` in `internal/scenario/server/handler.go`.
2. Mirror the same fix in `internal/server/handler.go` or remove that legacy copy.
3. Add a server test that fails if a snapshot endpoint returns `200` with an empty body.

### Phase 2: Fix the `zombie-fleet` scenario

1. Replace `||` numeric defaults with explicit `undefined` checks.
2. Guard wall damage against inconsistent `walls` and `wallHp` state.
3. Add a regression test that steps `zombie-fleet` twice and confirms the response is JSON-encodable.

### Phase 3: Fix slider semantics

1. Update `Session.UpdateSpec()` to preserve `last.Actual`, `last.Diff`, `last.Actions`, and `last.Logs`.
2. Ensure WebSocket `snapshot.updated` after a spec change reflects the preserved snapshot state.
3. Add a regression test that updates spec after a tick and confirms the next returned snapshot still contains the previous runtime view.

### Phase 4: Harden the UI

1. Wrap HTTP `json()` and WebSocket parsing in explicit guards.
2. Surface an operator-facing transport error instead of leaving an uncaught exception.

## Open Questions

1. Should spec edits optionally trigger an immediate recompute tick, or should they only update desired state and wait for the next scheduled/manual tick?
2. Should the Go runtime validate exported snapshot payloads for `NaN` or `Inf` before publishing, even when scenarios are buggy?
3. Should `GET /api/session/snapshot` and `GET /ws` share one central serialization path to avoid drift?

## References

- `ui/src/ScenarioApp.tsx:661-691`
- `internal/scenario/runtime/session.go:177-185`
- `internal/scenario/runtime/session.go:301-326`
- `internal/scenario/server/handler.go:219-251`
- `internal/server/handler.go:142-170`
- `scenarios/zombie-fleet/observe.js:1-98`
- `ttmp/2026/03/13/SCENARIO-CLEANUP-001--cleanup-and-modularization-plan-for-scenario-runtime-and-workbench/scripts/inspect_snapshot.go`
