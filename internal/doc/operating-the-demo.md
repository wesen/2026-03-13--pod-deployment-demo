---
Title: "Operating the Demo"
Slug: "operating-the-demo"
Short: "Step-by-step guide to running the server, opening the workbench, and driving a scenario."
Topics:
- pod-deployment-demo
- frontend
- operations
Commands:
- serve
- help
Flags:
- addr
- scenarios-dir
IsTopLevel: false
IsTemplate: false
ShowPerDefault: true
SectionType: Tutorial
---

This tutorial walks through running the demo and validating the main operator loop. It matters because the project is easiest to understand from the outside in: start the server, open the browser, then watch how API calls and live events change the snapshot.

## Prerequisites

This section covers what must exist before the walkthrough will work.

- Go 1.25 or compatible toolchain
- The repo checked out with the `scenarios/` directory present
- Frontend assets built or generated if you want to test the embedded production bundle

If you are developing the UI separately, a local Vite dev server is fine. If you are validating the production binary, rebuild embedded assets first:

```bash
go generate ./internal/web
```

## Step 1: Start the Server

This section covers the core entrypoint and why the flags matter.

```bash
go run ./cmd/scenario-demo serve --addr :3001 --scenarios-dir ./scenarios
```

Use `--addr` when another process already owns port 3001. Use `--scenarios-dir` when you want to test an alternate preset set or a fixture tree.

## Step 2: Open the Workbench

This section covers the main UI surface.

Open `http://localhost:3001`. The workbench should show:

- the active preset strip,
- editable desired-state controls,
- runtime transport controls such as run, pause, step, reset, and speed,
- current desired, actual, diff, and actions panels,
- runtime logs.

If the page renders a "frontend assets missing" message, the backend is healthy but the embedded bundle is absent or stale.

## Step 3: Drive a Scenario

This section covers the minimum useful operator loop.

1. Pick a preset from the strip.
2. Edit one or more desired-state controls.
3. Press `Step` to run a single reconcile cycle.
4. Inspect `actual`, `diff`, and `actions`.
5. Press `Run` to watch the loop continue automatically.

Use `Reset` when you want a clean VM and clean desired state without changing presets. Use preset switching when you want a full runtime rebuild with a different scenario package.

## Step 4: Inspect the Transport

This section covers direct verification outside the browser.

Fetch the latest snapshot:

```bash
curl http://localhost:3001/api/session/snapshot
```

List presets:

```bash
curl http://localhost:3001/api/presets
```

These endpoints matter because they let you separate UI bugs from backend bugs. If the HTTP payload is correct and the browser is wrong, the issue is in the frontend reducer or rendering path. If the HTTP payload is already wrong, investigate the session or preset logic.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Port 3001 is already in use | Another process owns the listen address | Start with `--addr` on a free port |
| The browser shows a JSON parse or websocket error | The backend emitted malformed or empty websocket payloads | Inspect the backend event stream and verify the latest frontend reducer code is running |
| The workbench controls update but the runtime does not move | The session is paused or a stage is failing | Use `Step` once and inspect runtime logs and the current phase |
| `go generate ./internal/web` fails | The UI dependencies or build toolchain are missing | Install the UI toolchain and run `pnpm --dir ui install` before regenerating assets |

## See Also

- `glaze help pod-deployment-demo`
- `glaze help runtime-architecture`
- `glaze help authoring-scenarios`
