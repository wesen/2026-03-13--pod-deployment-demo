# Tasks

## Completed In This Ticket

- [x] Create `SCENARIO-CLEANUP-001` ticket workspace and primary docs.
- [x] Map the canonical runtime entrypoints in `cmd/pod-demo/main.go`, `cmd/scenario-demo/main.go`, and `internal/app/app.go`.
- [x] Inspect the scenario runtime core in `internal/scenario/catalog`, `internal/scenario/runtime`, `internal/scenario/server`, and `internal/events`.
- [x] Inspect the current React workbench in `ui/src/ScenarioApp.tsx` and the Vite configuration in `ui/vite.config.ts`.
- [x] Inspect the legacy pod-demo backend still present in `internal/server` and `internal/system`.
- [x] Validate the local two-process workflow in `tmux` outside the sandbox.
- [x] Write a detailed intern-facing analysis, review, and implementation guide.
- [x] Research the empty-snapshot / `JSON.parse` failure and the slider-driven state reset behavior.
- [x] Write a focused bug report with reproduction steps, root causes, and fix recommendations.
- [x] Write a dedicated Go architecture review focused on abstraction clarity, consistency, idiomatic code, duplication, and file organization.
- [x] Update the ticket diary and changelog.
- [x] Validate the ticket with `docmgr doctor`.
- [x] Upload the guide bundle to reMarkable and verify the remote listing.

## Backend Cleanup Tasks

- [x] Fix `scenarios/zombie-fleet/observe.js` so zero-valued wall state does not produce `NaN` snapshots.
- [x] Make JSON writing fail closed in the active scenario server instead of returning `200 OK` with an empty body.
- [x] Fix `Session.UpdateSpec()` so slider changes preserve the current runtime snapshot instead of rebuilding an empty one.
- [x] Add regression tests for multi-step `zombie-fleet` execution and non-empty snapshot bodies.
- [x] Move the event envelope out of `internal/domain` and into `internal/events`.
- [x] Choose `cmd/scenario-demo` as the sole canonical binary entrypoint and remove `cmd/pod-demo`.
- [x] Delete the legacy pod-demo backend packages: `internal/server`, `internal/system`, `internal/controller`, `internal/state`, `internal/worker`, and `internal/domain`.
- [x] Move repo-root and scenario-directory resolution out of `internal/app/app.go` into shared config/path helpers.
- [x] Keep `internal/app/app.go` assembly-only after helper extraction.
- [x] Add an explicit config surface for `ADDR`, `SCENARIOS_DIR`, and frontend-dev proxy expectations.

## Frontend Modularization Tasks

- [ ] Create `ui/src/scenario/types.ts` for transport and view-model types.
- [ ] Create `ui/src/scenario/api.ts` for HTTP calls and snapshot-envelope decoding.
- [ ] Create `ui/src/scenario/reducer.ts` for event reduction.
- [ ] Create `ui/src/scenario/useScenarioSession.ts` for initial load, reconnect, and mutation orchestration.
- [ ] Move the inline `ScenarioApp.tsx` CSS into `ui/src/scenario/workbench.css`.
- [ ] Extract focused UI components for `PresetStrip`, `TransportBar`, `SpecPanel`, `StatePanels`, `DataPanel`, and `RuntimeLogPanel`.
- [ ] Reduce `ui/src/ScenarioApp.tsx` to a small composition root.
- [ ] Add at least one reducer- or hook-level test covering malformed transport input and snapshot updates.

## Build And Workflow Tasks

- [ ] Standardize the frontend on `pnpm` and remove `ui/package-lock.json`.
- [ ] Add `packageManager` metadata and a committed `pnpm-lock.yaml`.
- [ ] Update `internal/web/generate_build.go` and other embedded-build messaging to use the `pnpm` workflow.
- [ ] Add a documented `tmux` dev helper script for Go plus Vite.
- [ ] Add a smoke test script that verifies the Go health endpoint, preset listing, snapshot reachability, and frontend index reachability.
- [ ] Re-run `go test ./... -count=1`, `npm --prefix ui run typecheck`, `npm --prefix ui run build`, `go generate ./internal/web`, and `docmgr doctor --root ttmp --ticket SCENARIO-CLEANUP-001 --stale-after 30` after the cleanup sequence.
