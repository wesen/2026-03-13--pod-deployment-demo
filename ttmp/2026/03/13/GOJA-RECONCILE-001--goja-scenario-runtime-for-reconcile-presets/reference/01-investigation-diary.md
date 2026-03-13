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
