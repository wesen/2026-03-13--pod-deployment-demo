# Changelog

## 2026-03-13

- Initial workspace created


## 2026-03-13

Created a new goja-focused research ticket, imported the scenario-runner source, and wrote a detailed intern guide for moving to a Go-hosted reconcile runtime with preset directories and goja VMs

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/design-doc/01-intern-guide-to-a-goja-driven-reconcile-runtime.md — Primary detailed design and implementation guide
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/reference/01-investigation-diary.md — Chronological investigation record
- /tmp/deployement-demo2.tsx — Imported source analyzed for preset and phase architecture


## 2026-03-13

Uploaded the goja runtime design bundle to reMarkable and verified the remote ticket folder

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/design-doc/01-intern-guide-to-a-goja-driven-reconcile-runtime.md — Included in the uploaded reMarkable bundle
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/reference/01-investigation-diary.md — Included in the uploaded reMarkable bundle


## 2026-03-13

Scaffolded the preset catalog layer and added two directory-backed scenario presets so the runtime can discover scenario metadata, UI schemas, and phase scripts from disk before the goja VM host is wired in

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/model/model.go — Shared preset metadata structures loaded by the catalog
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/catalog/catalog.go — Filesystem loader for scenario directories and phase scripts
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/catalog/catalog_test.go — Catalog coverage for preset discovery and phase loading
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/scenarios/space-station/scenario.json — First sample preset metadata
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/scenarios/taco-fleet/scenario.json — Second sample preset metadata


## 2026-03-13

Implemented the goja-backed runtime, session loop with preset switching, full HTTP API, WebSocket event stream, and a new scenario-demo entrypoint — completing the backend half of the generic reconcile architecture

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/vm.go — Goja VM wrapper with host primitives and phase execution
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/session.go — Session manager with tick loop, preset switching, and event publishing
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/server/handler.go — HTTP API and WebSocket handler for the scenario runtime
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/cmd/scenario-demo/main.go — New entrypoint for the scenario runtime server


## 2026-03-13

Reviewed the current runtime and workbench integration state, documented the split between the new scenario runtime and the legacy pod-demo path, and wrote an intern-focused stabilization guide before re-uploading the ticket bundle to reMarkable

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/design-doc/02-intern-review-of-the-current-goja-runtime-and-ui-integration.md — New implementation review and stabilization guide
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/cmd/pod-demo/main.go — Evidence for the old default entrypoint still pointing at the legacy app
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/cmd/scenario-demo/main.go — Evidence for the new runtime existing in a parallel entrypoint
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/ScenarioApp.tsx — Evidence for the new uncommitted workbench UI and its current backend contract assumptions


## 2026-03-13

Stabilized the first backend repair slice by making the scenario session snapshot authoritative: active UI schema now rides inside the session snapshot, mutating endpoints return fresh snapshots, immediate update events are published for visible state changes, and tests now lock that contract in place

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/session.go — Snapshot model and session mutation behavior now publish authoritative state
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/server/handler.go — Mutating endpoints now return fresh snapshots
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/session_test.go — Session tests cover UI-in-snapshot and speed mutation behavior
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/server/handler_test.go — HTTP tests assert returned snapshots for step, switch, spec, reset, and speed


## 2026-03-13

Collapsed the canonical application bootstrap onto the scenario runtime so the default app, the pod-demo binary, the scenario-demo binary, and the Vite proxy all target the same backend behavior and port

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/app/app.go — Default app now loads scenarios and serves the scenario runtime
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/app/app_test.go — New bootstrap test for the canonical scenario app
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/cmd/pod-demo/main.go — Default binary now boots the scenario runtime app
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/cmd/scenario-demo/main.go — Scenario demo binary reduced to an alias of the canonical app
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/vite.config.ts — Dev proxy realigned to the canonical backend port


## 2026-03-13

Updated the new React workbench to consume authoritative backend snapshots for mutations, stopped fetching active preset UI out-of-band, and locked the new workbench in as the frontend entrypoint that should be embedded next

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/ScenarioApp.tsx — Workbench now applies returned snapshots and reads UI schema from the session snapshot
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/main.tsx — React entrypoint now mounts the scenario workbench
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/index.html — Browser title updated to the reconcile workbench
