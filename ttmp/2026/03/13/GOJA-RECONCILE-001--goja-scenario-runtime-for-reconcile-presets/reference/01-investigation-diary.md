---
Title: Investigation Diary
Ticket: GOJA-RECONCILE-001
Status: active
Topics:
    - backend
    - frontend
    - architecture
    - websocket
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: ../../../../../../../../../../../tmp/deployement-demo2.tsx
      Note: Actual source path after correcting the filename mismatch
    - Path: ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/sources/local/Deployment Demo 2 React Source.tsx
      Note: Ticket-local source artifact referenced in the diary
ExternalSources: []
Summary: Investigation record for the goja scenario-runtime ticket, including source path correction and architectural conclusions.
LastUpdated: 2026-03-13T14:09:29.688108354-04:00
WhatFor: ""
WhenToUse: ""
---


# Investigation Diary

## Goal

Record how the goja-focused scenario-runtime ticket was created, which source files informed the design, and why the architecture recommendations were made.

## Step 1: Create The New Ticket And Map The Architectural Pivot

This ticket starts from a different premise than the earlier pod-specific implementation work. Instead of documenting or extending one hardcoded pod simulation, the goal here is to design a generic Go-hosted reconcile runtime where the host loop stays in Go and scenario-specific behavior is executed from JavaScript presets inside goja.

The imported React source is important because it already demonstrates a generic scenario abstraction with editable `observe`, `compare`, `plan`, and `execute` phases. The current repository is important because it already demonstrates correct backend ownership. The analysis in the main design doc combines those two directions into one proposed system.

### Prompt Context

**User prompt (verbatim):**

```text
Use a real reconcile loop with pluggable JS scenarios,
 allow launching with different presets (irectories with js files).

The goal is to create a core generic architecture in go, and then execute the real functionality in JS. Expose a set of primitives to the JS VM. Restart VM when switching presets.

Create a new ticket, use goja, import /tmp/deployment-demo2.tsx. 

Create a detailed analysis / design / implementation guide that is very detailed for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file
  references.
  It should be very clear and detailed. Store in the ticket and the nupload to remarkable.
```

**Assistant interpretation:** Create a fresh docmgr ticket for a goja-based preset runtime, import the new source input, analyze both the imported source and the current codebase, and write a detailed intern-oriented architecture and implementation guide before uploading it to reMarkable.

**Inferred user intent:** Shift the system from a hardcoded domain-specific reconcile demo to a reusable host/runtime split where Go owns the loop and JavaScript provides scenario behavior.

**Commit (code):** N/A

### What I did

- Checked the requested source path `/tmp/deployment-demo2.tsx`.
- Found that the actual file on disk was `/tmp/deployement-demo2.tsx`.
- Created ticket `GOJA-RECONCILE-001`.
- Added the primary design doc and this diary.
- Imported `/tmp/deployement-demo2.tsx` into the ticket as `Deployment Demo 2 React Source.tsx`.
- Read the imported source and current repo files to anchor the analysis.

### Why

- The user explicitly asked for a new ticket and a fresh analysis, not an incremental note inside the previous pod ticket.
- The filename mismatch had to be resolved before import so the ticket would store the actual source artifact used for the analysis.
- The design needed to compare two concrete things: the new imported browser-side scenario runner and the repo’s current backend-owned pod runtime.

### What worked

- The source file was present under a predictable misspelling and imported cleanly once discovered.
- The imported source provided clear line-level evidence of the intended scenario structure and preset switching semantics.
- The current repository already offered enough backend/runtime material to make the architecture recommendation concrete.

### What didn't work

- The exact path from the prompt did not exist:

```text
$ ls -l /tmp/deployment-demo2.tsx
ls: cannot access '/tmp/deployment-demo2.tsx': No such file or directory
```

- The actual file was:

```text
/tmp/deployement-demo2.tsx
```

### What I learned

- The imported source is not merely "another frontend demo"; it is effectively a sketch of a scenario-runtime product, but with the VM living in the browser.
- The current repo is not yet generic, but it already has the right control-plane ownership boundary for the next step.

### What was tricky to build

- The main subtlety was architectural comparison. It would have been easy to analyze only the imported source, but that would ignore the backend/runtime work already present in the repository. The useful design had to compare both systems and explain how to merge the good parts of each.

### What warrants a second pair of eyes

- The proposed preset directory contract and API surface are deliberately explicit, but they still assume a single active runtime model. If the product wants one runtime per connected client instead, some session semantics will change.
- The document recommends a narrow primitive surface for goja; if future scenarios require richer host powers, the primitive set will need another design pass.

### What should be done in the future

- Implement the goja runtime behind a new scenario/session package rather than modifying the current pod-specific controller in place.
- Replace the current pod-specific React control room with a generic scenario workbench.

### Code review instructions

- Start with the primary design doc in `design-doc/01-intern-guide-to-a-goja-driven-reconcile-runtime.md`.
- Cross-check the evidence references against `/tmp/deployement-demo2.tsx`, `internal/system/service.go`, `internal/controller/controller.go`, and `ui/src/App.tsx`.
- Validate the finished ticket with `docmgr doctor --root ttmp --ticket GOJA-RECONCILE-001 --stale-after 30`.

### Technical details

- Ticket ID: `GOJA-RECONCILE-001`
- Actual imported source path: `/tmp/deployement-demo2.tsx`
- Imported source artifact: `sources/local/Deployment Demo 2 React Source.tsx`

## Step 2: Scaffold The Preset Catalog And Scenario Directories

The first implementation slice focused on the stable boundary that everything else needs: a filesystem contract for scenario presets and a Go package that can load those presets into a typed representation. This avoids coupling the goja runtime to ad hoc file access and gives the rest of the system a consistent catalog API.

### Prompt Context

**User prompt (verbatim):**

```text
go ahead, tasks, commit, diary, etc..
```

**Assistant interpretation:** Start implementing the ticket in small slices, keep the ticket documentation current, and commit incrementally rather than waiting for the entire runtime to exist.

**Inferred user intent:** Build the architecture described in the ticket with disciplined change slices, each one leaving behind code, docs, and commit history that an intern can follow.

**Commit (code):** Pending during this diary entry

### What I did

- Added `internal/scenario/model` with typed preset metadata structures.
- Added `internal/scenario/catalog` to load `scenario.json`, `spec.json`, `ui.json`, and the four phase scripts from preset directories.
- Added a focused catalog test that asserts both sample presets load correctly.
- Created two sample preset directories:
  - `scenarios/space-station`
  - `scenarios/taco-fleet`
- Converted the imported browser-side phase ideas into standalone phase files:
  - `observe.js`
  - `compare.js`
  - `plan.js`
  - `execute.js`

### Why

- The runtime cannot be generic until scenarios are represented as data plus scripts rather than hardcoded Go branches.
- A catalog package gives the future session/runtime layer a clear dependency: it can ask for a preset by ID instead of manually reading files.
- The sample presets are not only fixtures. They are also executable examples for the future intern guide and runtime tests.

### What worked

- `gofmt` ran cleanly on the new Go packages.
- `go test ./internal/scenario/... -count=1` passed, confirming that the loader finds both presets and captures phase scripts.
- The preset directory shape maps cleanly onto the contract described in the design doc.

### What didn't work

- Nothing failed in this slice, but the files are still only a scaffold until the goja host binds the expected primitives such as `getState`, `setState`, `randomFloat`, and `log`.

### What I learned

- The imported React preset model translates well to a disk format if phase functions are treated as files rather than inline strings.
- The safest early abstraction is `Catalog -> Preset`, not `VM -> Filesystem`.

### What was tricky to build

- The sample scripts had to be rewritten from inline browser-side function bodies into phase files that assume host-provided primitives. That changes the execution environment while preserving scenario behavior.

### What warrants a second pair of eyes

- The `spec.json` and `ui.json` structures are intentionally permissive right now. Once the frontend starts relying on them, schema validation may need to become stricter.
- The sample scenario content is representative, not canonical. If product requirements change, only the catalog contract should be treated as stable.

### What should be done in the future

- Add the goja host/runtime layer that executes these phase scripts against an in-memory session state.
- Feed the loaded `ui.json` and `spec.json` documents through the API so the generic frontend can render controls without pod-specific assumptions.

### Code review instructions

- Review `internal/scenario/catalog/catalog.go` first to confirm the preset directory contract is explicit and minimal.
- Check `internal/scenario/catalog/catalog_test.go` to verify the expected catalog behavior is captured by tests.
- Skim both scenario directories to confirm the phase split matches the imported source model.

### Technical details

- Test command: `go test ./internal/scenario/... -count=1`
- New preset roots:
  - `scenarios/space-station`
  - `scenarios/taco-fleet`

## Step 3: Implement The Goja Runtime, Session Loop, HTTP API, And WebSocket Stream

This is the main implementation slice. It wires the goja VM into a session-based runtime with a full HTTP API and WebSocket event stream, completing the backend half of the architecture described in the design doc.

### Prompt Context

**User prompt (verbatim):**

```text
Work on docmgr ticket GOJA-RECONCILE-001, check off task by task, commit as you go, keep a diary, continue our colleagues work, make sure to read the previous diary and the design-doc.
```

**Assistant interpretation:** Pick up where the previous colleague left off (after the catalog scaffold), implement the next unchecked tasks, and maintain the documentation chain.

**Inferred user intent:** Complete the backend runtime so the system actually executes scenarios, not just loads them.

**Commit (code):** `feat(runtime): add goja-backed session loop, HTTP API, and WebSocket stream`

### What I did

- Added `github.com/dop251/goja` as a direct dependency.
- Created `internal/scenario/runtime/vm.go` — goja VM wrapper that:
  - Creates a fresh goja runtime per preset.
  - Registers host primitives: `getState`, `setState`, `log`, `randomFloat`, `randomInt`, `round`.
  - Compiles and initializes phase scripts (`observe.js`, `compare.js`, `plan.js`, `execute.js`).
  - Provides typed call helpers: `RunObserve`, `RunCompare`, `RunPlan`, `RunExecute`.
- Created `internal/scenario/runtime/session.go` — session manager that:
  - Owns one active preset + VM + state + tick counter.
  - Implements `Run`/`Pause`/`Step`/`Reset`/`SwitchPreset`.
  - Publishes `snapshot.updated`, `preset.changed`, `session.state`, `session.reset`, `runtime.error` events via the existing events hub.
  - Keeps a bounded 500-entry log history.
- Created `internal/scenario/server/handler.go` — HTTP API routes:
  - `GET /api/presets` — list available presets.
  - `POST /api/session/preset` — switch preset (rebuilds VM).
  - `POST /api/session/run|pause|step|reset` — runtime control.
  - `GET|PUT /api/session/spec` — desired-state editing.
  - `POST /api/session/speed` — change tick interval.
  - `GET /api/session/snapshot` — full session state.
  - `GET /ws` — WebSocket event stream (initial snapshot + live events).
- Created `cmd/scenario-demo/main.go` — new entrypoint that loads the catalog from `scenarios/`, initializes a session with the first preset, and serves on `:3002`.
- Added 6 runtime unit tests and 7 HTTP handler tests (14 total new tests).
- Ran a full end-to-end smoke test against the running server.

### Why

- The catalog scaffold from Step 2 provided the loading layer; this step adds the execution layer so scenarios actually run.
- The design doc prescribed a clean VM lifecycle (new VM per preset switch) which is now implemented literally.
- Keeping the session and HTTP API in separate packages from the existing pod-demo server means the two systems coexist without conflict.

### What worked

- The goja VM correctly executes both preset phase scripts with all host primitives.
- The space-station observe/compare/plan/execute cycle produces correct atmospheric simulation results (CO2 scrubbing, repressurization, temperature control, hydroponics toggle).
- The taco-fleet cycle correctly dispatches trucks, generates orders, and routes fleet to hot zones.
- Preset switching rebuilds the VM and resets state cleanly — no cross-preset contamination.
- All 14 new tests pass, all existing tests still pass.

### What didn't work

- Initial attempt used `call.This.ToObject(nil).Runtime()` in standalone functions to get the goja runtime for `randomFloat`/`randomInt`/`round`. The goja `*Object` type has no exported `Runtime()` method. Fixed by making these methods on the VM struct so they can access `vm.rt` directly.
- The `go get` command initially targeted the wrong package path (`github.com/AcmeCorp-staging1/goja`). The user corrected this to the actual package at `github.com/dop251/goja`.

### What I learned

- The goja function call convention requires either closures capturing the runtime or method receivers to produce `goja.Value` return types — standalone functions cannot discover their owning runtime from the call context.
- The existing `events.Hub` and `domain.Event` types are generic enough to serve both the pod-demo and the scenario runtime without modification.

### What was tricky to build

- The phase function signatures differ: `observe(desired)`, `compare(desired, actual)`, `plan(desired, actual, diff)`, `execute(desired, actual, diff, actions)`. Each needs a different call helper in the VM wrapper, and the return types differ (map vs slice vs void). This required careful type export handling.
- The `round()` primitive needed in `observe.js` was not in the original design doc's primitive list but was used by the space-station scenario. Added it to avoid runtime errors.

### What warrants a second pair of eyes

- The session mutex is held during the entire tick. If phase scripts become expensive, this could block API calls. For this demo the concern is minor, but a production system would want phase-level locking.
- The `deepCopyMap` function uses JSON marshal/unmarshal which silently drops non-JSON-serializable values. This is fine for the current scenarios but could surprise future preset authors.

### What should be done in the future

- Build the generic scenario workbench frontend (next task).
- Add `go generate` integration for the scenario-demo binary.
- Consider adding a `--preset` flag to start with a specific preset instead of the first alphabetical one.

### Code review instructions

- Start with `internal/scenario/runtime/vm.go` to understand the VM boundary and primitive surface.
- Then read `internal/scenario/runtime/session.go` for the tick lifecycle and preset switching.
- Check `internal/scenario/server/handler.go` for the API contract.
- Run `go test ./internal/scenario/... -count=1 -v` to see all tests pass.
- Optionally run `go run ./cmd/scenario-demo/` and test with curl as described in the smoke test.

### Technical details

- Dependency added: `github.com/dop251/goja v0.0.0-20260311135729-065cd970411c`
- New entrypoint: `cmd/scenario-demo/main.go` (port 3002, env `SCENARIOS_DIR`, `ADDR`)
- Test command: `go test ./internal/scenario/... -count=1`
- Smoke test: `go run ./cmd/scenario-demo/ &` then curl endpoints

## Step 4: Review The Current Runtime State And Document The Integration Failures

After the runtime landed, the next useful step was not more coding. The useful step was to inspect how the new backend and new UI were actually wired into the repository. That review showed that the runtime and UI work are both directionally strong, but the repository still behaves like two applications living side by side. The review document written in this step is intended to help a new intern understand that distinction quickly.

The main conclusion is that the biggest problems are not in the goja loop itself. The biggest problems are ownership and integration problems: the old pod-demo path is still the default application, the new workbench UI is not yet the embedded UI that Go serves, and some backend mutations do not publish authoritative state updates.

### Prompt Context

**User prompt (verbatim):**

```text
I sadly gave this task to your colleague which has done some big fuckshit on the backend especially, have a look, analyze it, create a detailed document (we were on GOJA-RECONCILE-001 still), for the intern, upload to remarkable. 

The UI is pretty nice, but there might be connection / fundamental issues, the design is good.
```

**Assistant interpretation:** Review the current implementation rather than continuing feature work, identify where the backend/runtime integration is structurally wrong, write a clear intern-oriented diagnosis, and upload the updated bundle.

**Inferred user intent:** Preserve the good design and good UI direction, but produce a sober technical assessment that explains what is actually wrong and what should be stabilized first.

**Commit (code):** N/A

### What I did

- Inspected the current runtime, handler, app bootstrap, and UI files.
- Compared the legacy app path against the new scenario-runtime path.
- Examined the current uncommitted UI diff and the current embedded asset tree.
- Ran:
  - `go test ./... -count=1`
  - `go test -race ./internal/scenario/... -count=1`
  - `npm --prefix ui run typecheck`
  - `npm --prefix ui run build`
- Attempted a live `go run ./cmd/scenario-demo` smoke test and recorded the sandbox socket restriction.
- Wrote a new design-doc reviewing the current implementation state and recommending a stabilization order.

### Why

- The user explicitly described the current backend state as suspect and asked for analysis, not more implementation.
- The right document for an intern is not just "what should exist", but "what exists now, what is salvageable, and what is currently misleading."
- The repository now has enough implementation detail that a second document was more useful than revising the original greenfield design doc.

### What worked

- The scenario packages pass both normal tests and race-detected tests.
- The new UI builds and typechecks cleanly.
- The review clearly separated product-direction problems from local implementation correctness.

### What didn't work

- A live server smoke test could not bind a port in this environment:

```text
2026/03/13 14:57:01 http server: listen tcp :3002: socket: operation not permitted
```

- The embedded frontend was still stale relative to the new workbench source, so the strongest integration claims could not be justified from the served asset path alone.

### What I learned

- The new runtime is not the main problem. The main problem is that the repo still has two application graphs and they are both partly alive.
- The new UI is good, but it currently relies on a backend state contract that is only partially authoritative.

### What was tricky to build

- The hard part was not writing the review. The hard part was separating "bad architecture" from "incomplete migration." The runtime code itself is coherent enough to pass tests, so the document had to explain that the deeper faults are at the app-boundary and asset-pipeline layers.

### What warrants a second pair of eyes

- The exact migration path from the old `internal/app` + `internal/server` stack to the scenario-runtime stack should be agreed explicitly before more feature work lands.
- The state contract between `ScenarioApp` and the scenario API needs a deliberate pass so spec and speed changes stop relying on optimistic local React state.

### What should be done in the future

- Collapse the repository onto one canonical app entrypoint.
- Refresh and commit the embedded assets so Go serves the current workbench.
- Make every mutating scenario API return and publish authoritative snapshot state.

### Code review instructions

- Read the new review doc in `design-doc/02-intern-review-of-the-current-goja-runtime-and-ui-integration.md`.
- Cross-check the split entrypoints in `cmd/pod-demo/main.go`, `internal/app/app.go`, and `cmd/scenario-demo/main.go`.
- Compare `ui/src/main.tsx` and `ui/src/ScenarioApp.tsx` with `internal/web/embed/public/assets/index-C0SybDHH.js` to see the embed drift.
- Re-run:
  - `go test ./... -count=1`
  - `go test -race ./internal/scenario/... -count=1`
  - `npm --prefix ui run typecheck`
  - `npm --prefix ui run build`

### Technical details

- New review document: `design-doc/02-intern-review-of-the-current-goja-runtime-and-ui-integration.md`
- Validation commands:
  - `go test ./... -count=1`
  - `go test -race ./internal/scenario/... -count=1`
  - `npm --prefix ui run typecheck`
  - `npm --prefix ui run build`

## Step 5: Make The Backend Session Snapshot Authoritative

The first repair slice focused on the state contract between backend and frontend. The earlier runtime implementation was usable, but it still made the frontend do too much guessing. Spec updates and speed changes did not publish immediate authoritative state, and the active UI schema was not present in the main session snapshot. That meant the browser had to combine optimistic local state with side fetches and websocket events.

This slice fixes that backend contract before touching app bootstrap or embedded assets. The session snapshot now includes the active preset UI schema, mutating endpoints return a fresh snapshot immediately, and the session publishes immediate update events for visible state mutations. That gives the frontend a single authoritative shape to render against.

### Prompt Context

**User prompt (verbatim):**

```text
fix it, add tasks (detailed granular tasks) and go task by task.
```

**Assistant interpretation:** Turn the review findings into a repair plan, break the repair into explicit ticket tasks, and then start fixing the architecture one stabilization slice at a time.

**Inferred user intent:** Replace vague "we should clean this up" advice with concrete engineering work that resolves the broken contracts without discarding the good parts of the runtime or UI.

**Commit (code):** Pending during this diary entry

### What I did

- Rewrote the remaining ticket work into granular stabilization tasks.
- Added the active preset UI schema directly to the runtime snapshot.
- Changed `Run`, `Pause`, `Step`, `Reset`, `UpdateSpec`, and `SetSpeed` to return fresh authoritative session state.
- Changed mutating HTTP handlers to return `snapshot` payloads instead of tiny acknowledgement-only responses.
- Published immediate update events for:
  - preset switch
  - run
  - pause
  - reset
  - spec update
  - speed update
  - tick completion
- Added tests that assert:
  - UI schema exists in the session snapshot
  - step returns a snapshot
  - preset switch returns a snapshot
  - spec mutation returns updated desired state
  - speed mutation returns updated speed state

### Why

- The review showed that the websocket itself was not the core problem. The core problem was that the backend was not authoritative for all visible UI state.
- This fix reduces UI guesswork and prepares the next slice, where the frontend can stop relying on optimistic local state patches.

### What worked

- `gofmt` ran cleanly on the updated runtime and handler files.
- `go test ./internal/scenario/... -count=1` passed after the contract changes.
- The repair stayed localized to the scenario runtime/server path and did not require touching the legacy pod-demo code yet.

### What didn't work

- Nothing failed in this slice once the contract boundary was clear. The remaining unresolved issues are repo-level wiring issues, not problems inside this repair step.

### What I learned

- The smallest useful backend repair was not "rewrite the UI" or "delete the old app." It was making visible session state authoritative first.
- Once the backend returns snapshots consistently, the next frontend cleanup becomes much simpler because the browser no longer has to speculate.

### What was tricky to build

- The session already had both `Snapshot` and `SessionState`, so the fix had to be careful about where the active UI schema and full log state should live. The clean outcome was to keep the snapshot payload useful enough for rendering while preserving `SessionState` as the full transport object.

### What warrants a second pair of eyes

- Event naming now mixes the older semantic events (`preset.changed`, `session.reset`, `session.state`) with `snapshot.updated`. That is still workable, but the next pass may want to simplify the event vocabulary.
- `cmd/pod-demo` and `internal/app` still point at the legacy application graph, so the repository is still split until the next slice lands.

### What should be done in the future

- Collapse the canonical app bootstrap onto the scenario runtime.
- Then update the React workbench to consume the authoritative mutation responses and remove the remaining optimistic update behavior.

### Code review instructions

- Start with `internal/scenario/runtime/session.go`.
- Then review `internal/scenario/server/handler.go`.
- Run `go test ./internal/scenario/... -count=1`.
- Confirm the ticket task list now reflects the completed backend contract work.

### Technical details

- Validation command: `go test ./internal/scenario/... -count=1`
- New snapshot field: active preset `ui`
- Mutating endpoints now return `{"ok": true, "snapshot": ...}`

## Step 6: Collapse The Canonical App Onto The Scenario Runtime

Once the backend state contract was fixed, the next most important problem was the split application topology. The runtime and workbench could still appear broken because the default application path in the repository was not the same product that the Vite development flow targeted. This slice fixed that by making `internal/app` serve the scenario runtime and by removing the behavioral divergence between `cmd/pod-demo` and `cmd/scenario-demo`.

This does not delete the old pod-demo packages yet, but it does make them non-canonical. The important result is that a developer can now think "the app" and mean one backend graph instead of two different ones.

### Prompt Context

**User prompt (verbatim):** (same as Step 5)

**Assistant interpretation:** Continue the repair plan after the authoritative backend fix and remove the split between the default app path and the scenario runtime path.

**Inferred user intent:** Make the repository coherent enough that backend and frontend debugging are happening against the same application.

**Commit (code):** Pending during this diary entry

### What I did

- Rewrote `internal/app/app.go` so the default app now:
  - resolves the scenarios directory,
  - loads the preset catalog,
  - creates the scenario session,
  - serves the scenario handler.
- Removed the old `system.Service` and old `internal/server` handler from the default app bootstrap path.
- Added `internal/app/app_test.go` to prove the default app now exposes `/api/session/snapshot`.
- Updated `cmd/pod-demo/main.go` to handle the new `app.New() (*App, error)` signature.
- Replaced `cmd/scenario-demo/main.go` with a thin alias to the canonical app so it no longer represents a separate backend behavior.
- Changed the Vite proxy back to port `3001` so development targets the same canonical app path.

### Why

- The review showed that the repo-level split was more damaging than the local runtime implementation details.
- Fixing the canonical bootstrap now makes all future frontend work much more trustworthy because development and the default Go server point at the same backend.

### What worked

- `gofmt` ran cleanly on the updated app and command files.
- `go test ./... -count=1` passed after the bootstrap swap.
- `npm --prefix ui run typecheck` still passed after the proxy update.

### What didn't work

- Nothing failed in this slice. The remaining work is now concentrated in the frontend cleanup and embed pipeline sync.

### What I learned

- The smallest meaningful way to reduce the app split was not to delete old packages immediately. It was to move the canonical bootstrap first and let the old packages become inert legacy code.
- Once the default app is canonical again, debugging instructions become much simpler for an intern.

### What was tricky to build

- The app package previously assumed an always-valid in-memory pod demo service. The scenario runtime requires filesystem-backed scenario loading, so the bootstrap needed real error handling and scenario root resolution instead of a zero-error constructor.

### What warrants a second pair of eyes

- `internal/server` and `internal/system` still exist in the repository and still pass their own tests, so someone unfamiliar with the migration could still treat them as active code.
- The final frontend cleanup should verify that no hidden assumptions about port `3002` remain anywhere else in the repo or docs.

### What should be done in the future

- Update the React workbench to consume the authoritative backend responses.
- Regenerate and commit the embedded assets so the Go-served UI matches the new workbench source.

### Code review instructions

- Start with `internal/app/app.go`.
- Then compare `cmd/pod-demo/main.go` and `cmd/scenario-demo/main.go`.
- Confirm `ui/vite.config.ts` now proxies to `3001`.
- Run:
  - `go test ./... -count=1`
  - `npm --prefix ui run typecheck`

### Technical details

- Canonical backend port: `:3001`
- Scenario root resolution now defaults to `<repo>/scenarios`
- New bootstrap test path: `/api/session/snapshot`

## Step 7: Update The Workbench To Trust Backend Snapshots

After the backend contract and canonical app bootstrap were fixed, the frontend could finally be simplified. The main goal in this slice was to remove the remaining places where the browser had to guess or patch local state. The workbench now treats mutation responses as authoritative and reads the active preset UI schema directly from the session snapshot.

This is the first point where the frontend starts behaving like a real client of the scenario runtime instead of a partially optimistic editor sitting on top of it.

### Prompt Context

**User prompt (verbatim):** (same as Step 5)

**Assistant interpretation:** Continue the stabilization plan by making the frontend actually consume the improved backend contract instead of keeping the earlier optimistic behavior.

**Inferred user intent:** Make the good-looking workbench actually trustworthy in behavior, not only in appearance.

**Commit (code):** Pending during this diary entry

### What I did

- Updated `ui/src/ScenarioApp.tsx` so mutation handlers now consume backend-returned snapshots for:
  - preset switch
  - run
  - pause
  - step
  - reset
  - speed change
  - spec update
- Removed the active-preset UI side fetch path from the React workbench.
- Switched the workbench to read `snapshot.ui` directly from the authoritative session snapshot.
- Kept websocket state reduction but aligned it with the richer session payloads now emitted by the backend.
- Validated with:
  - `npm --prefix ui run typecheck`
  - `npm --prefix ui run build`

### Why

- The previous workbench looked good but still relied on optimistic state patches for spec changes and a separate fetch path for active preset UI metadata.
- Now that the backend returns and emits authoritative snapshots, the browser should stop inventing state locally wherever possible.

### What worked

- TypeScript still typechecked after the contract changes.
- The production build succeeded with the updated workbench entrypoint.
- The workbench code became simpler because the `uiSchemas` cache and the `/api/presets/{id}/ui` fetch path were no longer needed for the active session.

### What didn't work

- Nothing failed in this slice. The remaining missing piece is embedding the newly built workbench into the Go-served asset path.

### What I learned

- Backend authority is only valuable if the frontend actually uses it. Once the workbench switched to returned snapshots, the component logic became noticeably less defensive.
- The active session snapshot is a better source of truth than a local cache keyed by preset ID for the currently selected scenario.

### What was tricky to build

- The workbench was already partially websocket-driven, so the update had to preserve live event reduction while also using mutation responses directly. The clean compromise was to treat both returned snapshots and pushed snapshots as the same state shape.

### What warrants a second pair of eyes

- The backend still exposes `/api/presets/{id}/ui`. It is no longer required by the active workbench flow, but it remains in the API for now.
- The final embed regeneration should confirm that the Go-served UI really is this new workbench and not still the stale pod dashboard bundle.

### What should be done in the future

- Regenerate and commit the embedded frontend assets.
- Run the full validation suite again once the embedded assets are refreshed.

### Code review instructions

- Start with `ui/src/ScenarioApp.tsx`.
- Confirm `ui/src/main.tsx` now mounts the scenario workbench.
- Run:
  - `npm --prefix ui run typecheck`
  - `npm --prefix ui run build`

### Technical details

- Active UI schema now comes from `snapshot.ui`
- Mutation helpers now expect `{"snapshot": ...}` response payloads

## Step 8: Refresh The Embedded Assets And Close The Ticket Loop

With the runtime, bootstrap, and React workbench all aligned, the last missing step was to make the Go-served asset path match the source tree again. Until this step, the canonical app could still serve stale frontend assets even though the UI code and backend contracts were already fixed. This slice regenerated the embedded bundle, reran the validation stack, and closed the remaining ticket tasks.

This is the step that makes the repository coherent again from the perspective of a new intern checking out the repo and running the default application path.

### Prompt Context

**User prompt (verbatim):** (same as Step 5)

**Assistant interpretation:** Finish the stabilization plan rather than stopping after partial fixes, and leave the ticket in a validated, continuation-friendly state.

**Inferred user intent:** End with one coherent product path, not a technically improved but still stale or half-documented repo.

**Commit (code):** Pending during this diary entry

### What I did

- Ran `go generate ./internal/web` to rebuild the embedded frontend assets from the updated workbench UI.
- Verified that the old embedded bundle was replaced by the new workbench bundle.
- Re-ran:
  - `go test ./... -count=1`
  - `go test -race ./internal/scenario/... -count=1`
  - `npm --prefix ui run typecheck`
  - `docmgr doctor --root ttmp --ticket GOJA-RECONCILE-001 --stale-after 30`
- Marked the remaining ticket tasks complete.

### Why

- Without regenerating the embedded assets, the canonical Go app could still serve stale frontend output even though the source tree had been repaired.
- The final validation pass was necessary because the fixes crossed backend runtime, app bootstrap, frontend contract, and embed pipeline boundaries.

### What worked

- `go generate ./internal/web` completed successfully and produced a new embedded JS asset.
- Full Go tests passed.
- Scenario race tests passed.
- TypeScript typechecking passed.
- `docmgr doctor` passed cleanly.

### What didn't work

- A live port-bound smoke test remains unavailable in this sandbox environment, so this final step still relies on build/test validation rather than an interactive browser run.

### What I learned

- The embed pipeline is the last mile of frontend/backend integration in this repo. Without running it, development and production continue to diverge even after the source code is fixed.
- Closing the ticket cleanly required equal attention to code, assets, and documentation.

### What was tricky to build

- The main difficulty was sequencing. Regenerating embed assets too early would have baked in a UI that still depended on the old optimistic contract. Waiting until after the backend and React fixes made the embed refresh meaningful and stable.

### What warrants a second pair of eyes

- The old legacy packages still exist and still compile, even though the canonical app path no longer uses them. A future cleanup can decide whether to archive or delete them.
- A live manual smoke test should still be run outside the sandbox once convenient.

### What should be done in the future

- Optional cleanup: remove the now-unused `/api/presets/{id}/ui` route if no other client needs it.
- Optional cleanup: retire or archive the old pod-demo-specific packages once the team is confident the scenario runtime is the only supported product path.

### Code review instructions

- Confirm `internal/web/embed/public/assets/index-Ca1ZU2Ty.js` exists and replaced the old bundle.
- Re-run:
  - `go generate ./internal/web`
  - `go test ./... -count=1`
  - `go test -race ./internal/scenario/... -count=1`
  - `npm --prefix ui run typecheck`
  - `docmgr doctor --root ttmp --ticket GOJA-RECONCILE-001 --stale-after 30`

### Technical details

- New embedded bundle: `internal/web/embed/public/assets/index-Ca1ZU2Ty.js`
- Removed embedded bundle: `internal/web/embed/public/assets/index-C0SybDHH.js`

## Step 9: Validate And Repair The Taco-Fleet Scenario

After the ticket stabilization work, the next targeted validation was the `taco-fleet` preset. The user reported that adding a truck did not appear to work. That turned out to be a real scenario bug, not a UI misunderstanding. The runtime regression test reproduced it immediately: even after dispatching a truck toward a desired fleet size of four, the second tick still showed only two trucks.

The root cause was the shape of host state returned by `getState("actual")`. The scenario assumed `actual.trucks` was a normal JavaScript array, but after the round-trip through Go host state it behaved like exported Go-backed state. That made array-style mutation unreliable, especially `push()`. The fix was to normalize the stored state back into plain JavaScript arrays and objects before mutating it.

### Prompt Context

**User prompt (verbatim):**

```text
Validate scenarios/taco-fleet and find bugs, adding truck doesn't seem to work
```

**Assistant interpretation:** Inspect the taco-fleet scenario directly, reproduce the truck-dispatch problem with a focused test, identify the real cause, and fix it if it is real.

**Inferred user intent:** Move beyond architectural cleanup and verify that the actual JS-driven scenario behavior is correct.

**Commit (code):** Pending during this diary entry

### What I did

- Inspected:
  - `scenarios/taco-fleet/observe.js`
  - `scenarios/taco-fleet/compare.js`
  - `scenarios/taco-fleet/plan.js`
  - `scenarios/taco-fleet/execute.js`
- Added a focused regression test in `internal/scenario/runtime/session_test.go` that:
  - switches desired trucks to 4,
  - steps the session twice,
  - asserts the fleet grows from 2 to 3.
- Reproduced the bug with:
  - `go test ./internal/scenario/runtime -run TacoFleet -count=1 -v`
- Fixed `observe.js` to clone `getState("actual")` into a plain JS object with a plain JS `trucks` array before mutation.
- Fixed `execute.js` reroute behavior to clone the truck list before mutating and storing it back into host state.
- Re-ran:
  - `go test ./internal/scenario/runtime -run TacoFleet -count=1 -v`
  - `go test ./internal/scenario/... -count=1`

### Why

- Scenario bugs are part of the product now. The host/runtime architecture can be correct while a preset still behaves incorrectly.
- A regression test was important here because this class of bug comes from Go-host/JS-VM boundary semantics and can easily reappear.

### What worked

- The new taco-fleet regression test failed before the fix and passed after the fix.
- The full scenario package test suite still passed after the scenario changes.
- The fix stayed local to the scenario script and did not require broad runtime changes.

### What didn't work

- Before the fix, the runtime regression test failed exactly as expected:

```text
=== RUN   TestSession_TacoFleet_DispatchesTruckTowardDesiredCount
    session_test.go:135: expected dispatched truck by second tick, got 2 trucks
--- FAIL: TestSession_TacoFleet_DispatchesTruckTowardDesiredCount (0.00s)
```

### What I learned

- Scenario authors cannot safely assume that host state retrieved from `getState()` will behave exactly like freshly created JavaScript arrays and objects.
- For collection-heavy presets, it is safer to normalize host state into plain JS values before mutating it.

### What was tricky to build

- The bug looked at first like it might simply be deferred lifecycle semantics, because dispatch happens on one tick and the new truck should appear on the next. The regression test proved the deeper issue: even on the next tick the fleet size was still stuck at two.

### What warrants a second pair of eyes

- Other presets that depend on nested collections or array mutation may need the same normalization pattern.
- A future runtime improvement could offer a host helper that returns normalized JS state directly instead of leaving each scenario to do that manually.

### What should be done in the future

- Audit the other scenarios for similar array or nested-object mutation assumptions.
- Consider adding a helper primitive like `cloneState(key)` or changing `getState` semantics to return plain JS structures.

### Code review instructions

- Start with the new taco-fleet test in `internal/scenario/runtime/session_test.go`.
- Then read the updated `scenarios/taco-fleet/observe.js` and `scenarios/taco-fleet/execute.js`.
- Re-run:
  - `go test ./internal/scenario/runtime -run TacoFleet -count=1 -v`
  - `go test ./internal/scenario/... -count=1`

### Technical details

- Reproduction command: `go test ./internal/scenario/runtime -run TacoFleet -count=1 -v`
- Fix strategy: normalize host state into plain JS arrays and objects before mutating collections

## Step 10: Add The Zombie-Fleet Scenario

The next scenario addition reused another strong idea from the imported React prototype: the zombie-defense simulation. Instead of copying it verbatim, this step adapted it into the repository’s current preset contract as a new directory-backed scenario called `zombie-fleet`. The goal was to add a third non-trivial preset that exercises nested state, resource depletion, and defensive planning without changing the runtime architecture again.

This also served as a useful check on the scenario system itself. A preset architecture is only credible if new presets can be added without touching the core runtime. That is exactly what happened here: the work stayed in the scenario directory plus test expectations.

### Prompt Context

**User prompt (verbatim):**

```text
Create a zombie fleet scneario as well
```

**Assistant interpretation:** Add a new preset to the scenario catalog, following the same directory-backed goja contract as the existing scenarios.

**Inferred user intent:** Prove that the generic runtime can support another rich scenario and not just the original two examples.

**Commit (code):** Pending during this diary entry

### What I did

- Added a new scenario directory:
  - `scenarios/zombie-fleet`
- Created:
  - `scenario.json`
  - `spec.json`
  - `ui.json`
  - `observe.js`
  - `compare.js`
  - `plan.js`
  - `execute.js`
- Adapted the imported zombie-defense behavior into the repo’s host primitive contract.
- Normalized nested array state in `observe.js` so wall HP and turret ammo behave as plain JS arrays after round-tripping through Go host state.
- Added runtime coverage in `internal/scenario/runtime/session_test.go`.
- Updated catalog and handler tests to expect three presets instead of two.

### Why

- The runtime architecture needs more than one or two examples to be convincing.
- The zombie scenario is useful because it stresses nested collections, action planning, and resource pressure in a different way from `space-station` and `taco-fleet`.

### What worked

- The new scenario loaded successfully from the catalog.
- A focused runtime step test for `zombie-fleet` passed.
- The full scenario package tests passed after updating expectations.

### What didn't work

- One handler test was still pinned to the old preset count and failed until updated:

```text
--- FAIL: TestListPresets (0.00s)
    handler_test.go:57: expected 2 presets, got 3
```

### What I learned

- The preset directory contract is now doing what it was supposed to do: new scenario behavior can be added without runtime surgery.
- It is worth normalizing nested collection state in scenarios that mutate arrays heavily, especially after the taco-fleet bug.

### What was tricky to build

- The imported zombie prototype used array-heavy state for walls and turret ammo. After the taco-fleet bug, it was important not to repeat the same host-state mutation assumption. The scenario was therefore written with normalization up front instead of waiting for another bug report.

### What warrants a second pair of eyes

- The naming is intentionally `zombie-fleet` to match the user request, even though the imported prototype concept was "zombie perimeter defense." If naming consistency matters, the team may want a short product naming pass later.

### What should be done in the future

- Optional: add UI-level smoke validation for selecting and stepping `zombie-fleet`.
- Optional: audit the other scenarios for nested-array normalization so the pattern is consistent.

### Code review instructions

- Start with the files under `scenarios/zombie-fleet/`.
- Then review `internal/scenario/catalog/catalog_test.go`, `internal/scenario/runtime/session_test.go`, and `internal/scenario/server/handler_test.go`.
- Run:
  - `go test ./internal/scenario/runtime -run ZombieFleet -count=1 -v`
  - `go test ./internal/scenario/... -count=1`

### Technical details

- New preset ID: `zombie-fleet`
- New preset tick speed: `900ms`
- Validation commands:
  - `go test ./internal/scenario/runtime -run ZombieFleet -count=1 -v`
  - `go test ./internal/scenario/... -count=1`
