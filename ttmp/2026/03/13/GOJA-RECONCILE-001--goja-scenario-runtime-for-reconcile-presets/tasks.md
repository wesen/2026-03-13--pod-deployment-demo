# Tasks

## TODO


- [x] Import the new scenario-runner source and verify the actual file path
- [x] Analyze the imported React scenario runner and the current Go/React MVP architecture
- [x] Write the intern-oriented goja architecture and implementation guide
- [x] Upload the design bundle to reMarkable
- [x] Scaffold generic scenario packages and preset directories for the goja runtime
- [x] Implement the goja-backed session loop, preset switching, HTTP API, and WebSocket stream
- [x] Run end-to-end validation, update the diary, and commit each implementation slice
- [x] Review the current goja runtime and workbench integration state, document the issues for an intern, and upload the review bundle
- [x] Make the scenario session snapshot authoritative by including active UI schema in the snapshot payload
- [x] Return fresh authoritative session snapshots from mutating scenario API endpoints
- [x] Publish immediate snapshot or state update events for spec, speed, run, pause, reset, and preset switch mutations
- [x] Add backend tests that lock the authoritative mutation contract in place
- [ ] Collapse the default `internal/app` bootstrap onto the scenario runtime instead of the legacy pod demo service
- [ ] Align the default Go server port and the Vite dev proxy so development and the canonical app target the same backend
- [ ] Keep `cmd/scenario-demo` as a thin alias or remove its behavioral divergence from the canonical app path
- [ ] Update the new React workbench to consume authoritative mutation responses instead of optimistic local state
- [ ] Remove the UI-side need for extra active-preset fetches where the session snapshot can carry the required data
- [ ] Regenerate embedded frontend assets so the Go-served UI matches `ui/src/ScenarioApp.tsx`
- [ ] Run full validation for backend, frontend, embed pipeline, and ticket hygiene
- [ ] Record each stabilization slice in the diary and changelog and commit each slice cleanly
