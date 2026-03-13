---
Title: "Getting Started"
Slug: "operating-the-demo"
Short: "Hands-on getting started guide for running the demo and understanding what the workbench is showing you."
Topics:
- pod-deployment-demo
- frontend
- operations
- getting-started
Commands:
- serve
- help
Flags:
- addr
- scenarios-dir
IsTopLevel: true
IsTemplate: false
ShowPerDefault: true
SectionType: Tutorial
Order: 30
---

This tutorial gets a new user from clone to comprehension. The goal is not only to make the app run, but to make the first session meaningful. By the end you should know what each panel represents, what one tick does, and how to separate runtime behavior from presentation behavior.

## Before You Start

This section covers the minimum prerequisites and why they matter.

You need:

- a Go 1.25-compatible toolchain,
- the repository with the `scenarios/` directory present,
- frontend assets built if you want to exercise the embedded production bundle rather than a separate dev server.

If you are validating the production path, generate the embedded assets first:

```bash
go generate ./internal/web
```

That command matters because the Go binary serves embedded frontend assets. If the bundle is missing, the server can still be healthy while the browser shows only the fallback HTML warning.

## Step 1: Run the Server

This section covers the main entrypoint and how to override defaults.

```bash
go run ./cmd/scenario-demo serve --addr :3001 --scenarios-dir ./scenarios
```

Use `--addr` when port `3001` is already taken. Use `--scenarios-dir` when you want to point the runtime at a different preset tree. The environment variables `ADDR` and `SCENARIOS_DIR` still work, but the flags are clearer when you are explaining the setup to another engineer.

## Step 2: Open the Workbench With the Right Expectations

This section covers how to read the UI.

Open `http://localhost:3001`. You should see:

- a preset strip,
- desired-state controls generated from `ui.json`,
- transport controls for run, pause, step, reset, and speed,
- structured data panels for desired state, actual state, diff, and actions,
- a runtime log view.

Do not treat the UI as a source of truth. It is a rendering of backend-authored snapshots. That distinction matters. The workbench is closer to an oscilloscope than to a smart client.

## Step 3: Run One Intentional Tick

This section covers the fastest path to understanding the reconciliation loop.

Use this sequence:

1. Pick a preset.
2. Change one desired-state control.
3. Press `Step`.
4. Read the panels in order: desired, actual, diff, actions, logs.

This sequence is more useful than pressing `Run` immediately. A single tick makes causality visible. You can see exactly what the runtime observed, what drift it found, what plan it generated, and what execution side effects it logged.

Only after that should you press `Run` to watch the loop continue automatically.

## Step 4: Verify the Backend Directly

This section covers how to debug without trusting the browser.

Fetch the latest snapshot:

```bash
curl http://localhost:3001/api/session/snapshot
```

List presets:

```bash
curl http://localhost:3001/api/presets
```

These checks matter because they let you separate interface bugs from runtime bugs. If the JSON is right and the browser is wrong, focus on the frontend. If the JSON is wrong, focus on the preset, session, or transport path.

## Step 5: Learn the Model, Not Just the Buttons

This section covers the next reading order after the first successful run.

After you have driven one preset manually, read the docs in this order:

1. `scenario-demo help reconciliation-loop-reference`
2. `scenario-demo help runtime-architecture`
3. `scenario-demo help authoring-scenarios`

That path moves from fundamentals to implementation to extension. It is the fastest way to become dangerous in the codebase.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| The browser says frontend assets are missing | The backend is serving the fallback page because the embedded bundle is stale or absent | Run `go generate ./internal/web` and restart the server |
| Clicking controls changes values but not behavior | The session may be paused or the active preset logic may not react the way you expect | Use `Step` and inspect the diff and action plan before assuming the UI is broken |
| The browser reports a WebSocket parse error | The event stream payload is malformed or empty | Compare against `/api/session/snapshot` and inspect recent runtime/frontend parsing changes |
| A new user understands the buttons but not the purpose | The loop semantics are still implicit | Point them to `scenario-demo help reconciliation-loop-reference` immediately after the first run |

## See Also

- `scenario-demo help pod-deployment-demo`
- `scenario-demo help runtime-architecture`
- `scenario-demo help reconciliation-loop-reference`
- `scenario-demo help authoring-scenarios`
