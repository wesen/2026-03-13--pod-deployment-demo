---
Title: "Runtime Architecture"
Slug: "runtime-architecture"
Short: "Backend architecture for catalog loading, session state, event fanout, and transport handling."
Topics:
- pod-deployment-demo
- scenario-runtime
- backend
Commands:
- serve
- help
IsTopLevel: false
IsTemplate: false
ShowPerDefault: true
SectionType: GeneralTopic
---

This page explains the backend architecture that turns static scenario files into a live reconcile loop. It matters because most bugs in this project are boundary bugs: a preset loads incorrectly, the VM carries state across resets, or the transport publishes an incomplete event.

## Startup Sequence

This section covers what happens between process start and the first browser paint.

`internal/app.LoadConfig` resolves the listen address and scenario root. `internal/app.NewWithConfig` then loads the scenario catalog, selects the first preset, constructs a session with a fresh Goja VM, and wires the shared event hub into the HTTP server.

The startup order is intentional:

1. Load the preset catalog first so startup fails fast on malformed scenario files.
2. Create the first session before binding HTTP routes so the server never exposes a half-initialized runtime.
3. Attach the event hub once so the WebSocket path and session publishing share a single fanout mechanism.

If startup fails, treat it as a content or configuration problem rather than a transport problem. Most boot-time errors come from missing JSON files, malformed JSON, or invalid JavaScript in a preset.

## Session Model

This section covers how session state is represented and why the backend owns it.

`runtime.Session` is the authoritative mutable state machine. It holds:

- the active preset,
- the current Goja VM,
- the desired state map,
- the last published snapshot,
- accumulated log history,
- the tick speed and running status,
- a cancel function for the background loop.

The session owns mutation APIs such as `Run`, `Pause`, `Step`, `Reset`, `SwitchPreset`, `SetSpeed`, and `UpdateSpec`. Each method updates backend state first and then publishes JSON-friendly snapshots and event envelopes. That design keeps transport handlers stateless and prevents the frontend from drifting away from backend truth.

## Tick Pipeline

This section covers one reconcile tick and why the phase boundaries are explicit.

Each tick executes the four stage files in order:

1. `observe.js` reads the desired state and produces the current actual state.
2. `compare.js` calculates drift between desired and actual.
3. `plan.js` decides what actions should reconcile the drift.
4. `execute.js` applies those actions and emits logs.

The backend snapshots the intermediate outputs after the full tick, not after every function call. That keeps the transport simple while still exposing the resulting `actual`, `diff`, `actions`, and `phase` fields to the UI.

When a stage fails, the runtime switches to an error phase and publishes a `runtime.error` event. That failure mode is deliberate: errors remain visible to the operator instead of being swallowed in the browser console.

## Transport Layer

This section covers the HTTP and WebSocket split.

HTTP routes under `/api/` handle request-response interactions such as listing presets, changing the desired spec, stepping the runtime, and fetching the latest snapshot. The WebSocket at `/ws` pushes the initial snapshot and subsequent events from the shared hub.

This separation matters operationally:

- HTTP remains easy to script and test.
- WebSocket traffic stays append-only and event-oriented.
- Reconnect behavior is simple because the browser can always fetch a fresh snapshot over HTTP before resubscribing to live updates.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Preset switching leaves old state behind | The session did not rebuild cleanly or the preset file set is inconsistent | Inspect `runtime.Session.SwitchPreset` behavior and confirm the preset directory contains all six required files |
| WebSocket clients connect but do not update | The event hub is not receiving publishes or the runtime is idle | Trigger `step` or `run`, then compare `/api/session/snapshot` with the live stream |
| Reset does not return to the initial desired state | The preset spec or deep-copy path is wrong | Verify `spec.json` and the session reset logic that reconstructs desired state from the preset |
| Startup fails before serving HTTP | Catalog loading rejected a preset | Validate `scenario.json`, `spec.json`, `ui.json`, and all stage scripts in the offending preset directory |

## See Also

- `glaze help pod-deployment-demo`
- `glaze help authoring-scenarios`
- `glaze help operating-the-demo`
