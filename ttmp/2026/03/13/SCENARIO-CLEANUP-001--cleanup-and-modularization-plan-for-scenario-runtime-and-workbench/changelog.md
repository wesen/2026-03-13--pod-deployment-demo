# Changelog

## 2026-03-13

- Expanded the ticket from analysis-only into an execution plan with granular cleanup tasks for runtime fixes, legacy removal, UI modularization, and build-workflow cleanup.
- Initial workspace created
- Mapped the canonical scenario runtime entrypoints, runtime loop, API surface, and current React workbench.
- Validated a real `tmux` two-process dev session outside the sandbox: Go server on `:3001`, Vite on `:3003` because `:3000`, `:3001`, and `:3002` were already occupied.
- Recorded that `ui/vite.config.ts` expects proxy targets on `localhost:3001`, while `internal/web/generate_build.go` still shells out to `npm`.
- Wrote an intern-facing cleanup and modularization guide with architecture diagrams, API references, pseudocode, and phased implementation guidance.
- Uploaded the ticket bundle to `/ai/2026/03/13/SCENARIO-CLEANUP-001` on reMarkable and verified the remote listing.
- Investigated the empty snapshot / `JSON.parse` failure and identified a concrete `zombie-fleet` `NaN` path plus a separate `UpdateSpec` snapshot-reset bug.
- Added a dedicated Go architecture review covering active abstractions, legacy duplication, event coupling, file organization, and idiomatic cleanup opportunities.

## 2026-03-13

Completed the cleanup review, validated the tmux-based Go plus pnpm dev workflow, and wrote the intern-facing architecture and modularization guide.

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/runtime/session.go — Scenario runtime loop documented as the architectural core
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/ScenarioApp.tsx — Primary UI cleanup target documented in the guide

## 2026-03-13

Added a focused defect report for the empty-snapshot and slider-reset failures, and added a separate Go architecture review for backend cleanup planning.

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/events/hub.go — Architectural review highlights the event-envelope coupling issue
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/scenarios/zombie-fleet/observe.js — Root cause of the reproducible NaN-backed snapshot corruption
