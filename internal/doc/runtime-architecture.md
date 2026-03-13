---
Title: "Runtime Architecture"
Slug: "runtime-architecture"
Short: "Detailed architecture guide for the Go runtime, transports, session state, and scenario sandboxing model."
Topics:
- pod-deployment-demo
- scenario-runtime
- backend
- reconciliation
Commands:
- serve
- help
IsTopLevel: true
IsTemplate: false
ShowPerDefault: true
SectionType: GeneralTopic
Order: 20
---

This guide explains how the backend turns a folder full of JSON and JavaScript into a live reconciliation system. It matters because the demo only stays understandable if its boundaries stay sharp: catalog loading is separate from session state, session state is separate from transport, and transport is separate from the UI.

The architecture is intentionally asymmetric. Go owns lifecycle, memory, network transport, timing, and snapshot publication. JavaScript owns scenario semantics. React owns presentation. That asymmetry keeps each layer legible.

## Boot Sequence

This section covers what happens from process start to first usable page.

`internal/app.LoadConfig` resolves `ADDR` and `SCENARIOS_DIR`. `internal/app.NewWithConfig` then does four things in order:

1. Load the scenario catalog from disk.
2. Select the first preset.
3. Build a fresh runtime session and Goja VM from that preset.
4. Wire the HTTP server around the session and shared event hub.

That ordering is deliberate. Startup should fail before the server listens if the preset set is invalid. A half-started demo that serves HTTP but cannot run a scenario is worse than a hard startup error because it gives users a false signal that the system is healthy.

## Catalog Layer

This section covers the boundary between files on disk and runtime memory.

The catalog loader scans the `scenarios/` directory and expects each child directory to be a complete preset package. It reads:

- metadata from `scenario.json`,
- initial desired state from `spec.json`,
- generated control definitions from `ui.json`,
- stage source strings from `observe.js`, `compare.js`, `plan.js`, and `execute.js`.

This layer does not interpret scenario semantics. Its job is only to validate that the package is structurally complete and to build an in-memory `model.Preset`. That narrow responsibility matters because it keeps catalog failures obvious. If a file is missing or malformed, the system fails at load time instead of producing strange runtime behavior later.

## Session Layer

This section covers the core state machine and why the backend must own it.

`runtime.Session` is the authoritative mutable object for one active preset. It tracks:

- the active preset,
- the current VM,
- the desired spec,
- the current tick count and phase,
- the latest snapshot,
- the running state and tick speed,
- bounded log history,
- a cancel function for the background loop.

Every control mutation funnels through the session: run, pause, step, reset, switch preset, set speed, and update spec. That design prevents the frontend from inventing behavior. The browser can request state changes, but it cannot author truth. Only the session can do that.

## Reconciliation Execution

This section covers how one tick actually runs.

During a tick, the session deep-copies the current desired state and executes the four stage functions in order. Each stage runs inside the preset's Goja VM:

1. `observe` returns a JSON-like view of the current world.
2. `compare` returns a JSON-like drift description.
3. `plan` returns an action list.
4. `execute` applies the actions and emits logs.

If any stage errors, the session marks the phase as error and publishes a runtime error event. If all stages succeed, the session flushes VM logs, appends them to the bounded history, increments the tick counter, returns to the idle phase, and publishes a `snapshot.updated` event.

The tick pipeline is valuable because it exposes decision boundaries. A user can see whether a problem is observational, comparative, planning-related, or execution-related instead of flattening all controller behavior into one opaque "reconcile" box.

## Goja Sandbox Model

This section covers what the JavaScript environment can and cannot do.

Each preset gets a fresh Goja runtime when the session is created, reset, or switched to a different preset. The Go host registers a very small set of primitives:

- `getState(key)` and `setState(key, value)` for per-VM private state,
- `log(message)` for operator-visible runtime logs,
- `randomFloat`, `randomInt`, and `round` for simulation helpers.

This is not a general-purpose plugin runtime. The JS code does not get raw filesystem access, arbitrary Go object references, or transport handles. It receives plain values and returns plain values. That constraint is the whole point. The runtime wants scenario logic to be expressive but still auditable and serializable.

The sandbox also preserves an important architectural property: implementation detail can stay hidden in JS while the system-level control loop remains visible in Go. A preset author can write clever internal logic in `compare.js` or `execute.js`, but the runtime still surfaces the resulting diff, actions, and logs to the operator.

## Transport and UI Contract

This section covers why the transport is split between HTTP and WebSocket.

HTTP endpoints handle command-style interactions: list presets, fetch a snapshot, mutate the desired spec, switch presets, and drive the session. The WebSocket sends the initial snapshot followed by live event envelopes from the event hub.

The browser fetches an initial snapshot and then listens for incremental updates. This keeps reconnect logic simple and preserves a clean debugging rule:

- if `/api/session/snapshot` is correct, the runtime is healthy and the problem is likely in the UI,
- if `/api/session/snapshot` is wrong, the problem is in the preset, session, or transport publication path.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Switching presets leaks old behavior | The VM or desired state was not rebuilt cleanly | Inspect `runtime.Session.SwitchPreset` and confirm the preset package is complete and valid |
| A tick fails with an unhelpful runtime error | The JS stage threw before producing structured output | Start by checking which phase failed, then inspect the corresponding stage file |
| Logs feel inconsistent across resets | The VM log buffer or session history assumptions are wrong | Remember that `FlushLogs` clears per-tick VM logs while the session keeps a bounded aggregate history |
| Architecture docs drift from the implementation | Ticket docs and embedded docs diverged | Treat the embedded Glazed docs as canonical and update them alongside runtime code |

## See Also

- `scenario-demo help pod-deployment-demo`
- `scenario-demo help operating-the-demo`
- `scenario-demo help reconciliation-loop-reference`
- `scenario-demo help authoring-scenarios`
