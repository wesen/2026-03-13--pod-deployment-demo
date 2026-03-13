---
Title: "Pod Deployment Demo"
Slug: "pod-deployment-demo"
Short: "Architecture and operating guide for the scenario-driven pod deployment demo."
Topics:
- scenario-runtime
- frontend
- presets
Commands:
- serve
- help
IsTopLevel: true
IsTemplate: false
ShowPerDefault: true
SectionType: GeneralTopic
---

This page explains what the pod deployment demo is, how the pieces fit together, and where to look when behavior goes wrong. The binary serves a browser UI and a JSON/WebSocket control surface for a scenario runtime. That runtime executes a four-stage reconcile loop implemented as JavaScript per scenario preset.

The project exists to demonstrate one concrete idea: treat reconciliation as an inspectable control loop instead of a hidden controller. The UI makes each stage visible, the backend owns state and replay semantics, and the scenario assets define what "desired", "actual", and "action plan" mean for each preset.

## Project Shape

This section covers the top-level structure, how it works in practice, and why it matters when you need to trace a bug.

`cmd/scenario-demo`

Runs the CLI entrypoint. The command now exposes `serve` plus Glazed-backed help topics so operational documentation ships inside the binary.

`internal/app`

Builds the HTTP server and wires together scenario catalog loading, the runtime session, the event hub, and the HTTP/WebSocket handler.

`internal/scenario/catalog`

Loads scenario presets from disk. Each subdirectory under `scenarios/` is a preset package containing metadata, desired-state JSON, UI controls, and the four JavaScript stage files.

`internal/scenario/runtime`

Hosts the Goja VM and the mutable session state. This layer is where ticks run, where preset switches rebuild the VM, and where backend-authored snapshots are published to clients.

`internal/scenario/server`

Exposes the JSON API and the `/ws` stream. This package is intentionally thin: it validates requests, delegates to the session, and writes transport-friendly payloads.

`internal/web`

Serves the Vite-built frontend bundle and falls back to `index.html` for SPA routing. Production assets are embedded into the Go binary.

`ui/`

Contains the React workbench. It fetches the initial snapshot over HTTP, then treats the backend WebSocket stream as the source of truth for incremental state updates.

## Runtime Contract

This section covers the data contract between scenario assets, the runtime, and the UI.

Every scenario preset contributes:

- `scenario.json` for metadata shown in the UI.
- `spec.json` for the initial desired state.
- `ui.json` for editor controls.
- `observe.js`, `compare.js`, `plan.js`, and `execute.js` for the reconcile stages.

Each tick produces a snapshot with:

- the active preset metadata and UI control definitions,
- the tick number and current phase,
- the desired state, actual state, diff, and planned actions,
- log lines accumulated for the current step and over the whole session,
- runtime state such as `running` and `speedMs`.

The browser never invents state locally. It renders whatever the backend returns and uses the reducer only to merge discrete server events into the latest snapshot. That discipline matters because it keeps "what happened" debuggable even when the frontend reconnects or a preset switch rebuilds the VM.

## Running the Demo

This section covers the main operational entrypoint and why the flags exist.

Run the server with:

```bash
go run ./cmd/scenario-demo serve
```

Useful overrides:

```bash
go run ./cmd/scenario-demo serve --addr :4010 --scenarios-dir ./scenarios
```

The command still honors environment variables:

- `ADDR` sets the listen address. Default: `:3001`
- `SCENARIOS_DIR` points at the preset root. Default: `<repo>/scenarios`

Use the embedded docs from the CLI:

```bash
go run ./cmd/scenario-demo help pod-deployment-demo
go run ./cmd/scenario-demo help runtime-architecture
go run ./cmd/scenario-demo help authoring-scenarios
```

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Browser loads but the workbench is empty | The backend could not load any presets or the frontend bundle is missing | Start with `go run ./cmd/scenario-demo serve`, then inspect startup errors and rebuild assets with `go generate ./internal/web` if the embedded bundle is stale |
| The UI shows stale state after reconnect | The WebSocket stream dropped and the browser has not received a fresh snapshot yet | Refresh the page or inspect `/api/session/snapshot`; the backend remains the source of truth |
| A preset fails immediately on tick | One of the scenario JavaScript stages threw inside Goja | Check the runtime error in the UI and inspect the preset's `observe.js`, `compare.js`, `plan.js`, or `execute.js` files |
| Help topics do not show up | Embedded docs failed to load or a slug/frontmatter field is invalid | Run `go test ./...` and `go run ./cmd/scenario-demo help pod-deployment-demo` to verify the help system can load the markdown sections |

## See Also

- `glaze help runtime-architecture`
- `glaze help authoring-scenarios`
- `glaze help operating-the-demo`
