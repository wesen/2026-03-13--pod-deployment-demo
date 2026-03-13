---
Title: Investigation Diary
Ticket: SCENARIO-CLEANUP-001
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
    - Path: internal/server/handler.go
      Note: Legacy backend route wiring compared against the scenario server
    - Path: internal/system/service.go
      Note: Legacy pod-demo service identified as cleanup target
    - Path: ui/package.json
      Note: Frontend script entrypoints used during dev workflow validation
    - Path: ui/vite.config.ts
      Note: Dev proxy and port behavior validated in tmux
ExternalSources: []
Summary: ""
LastUpdated: 2026-03-13T17:31:00-04:00
WhatFor: Chronological investigation log for the scenario cleanup and modularization review.
WhenToUse: Use when continuing the cleanup ticket or reviewing why the analysis and recommendations were written this way.
---


# Investigation Diary

## Goal

Capture the investigation that led to the cleanup and modularization recommendations for the current scenario runtime and workbench.

## Context

This ticket is analysis-only. No production code was changed in this pass. The deliverable is a detailed intern-facing guide that explains how the current system works, how to run it locally with Go plus Vite, where the codebase is unnecessarily confusing, and what should be simplified next.

## Quick Reference

### Step 1: Map The Runtime, Validate The Dev Loop, And Write The Cleanup Guide

This step established which backend is actually active, validated the two-process dev loop in `tmux`, and turned the findings into an intern-oriented cleanup guide. The most important conclusion is that the scenario runtime itself is the good part of the repo, while the main cleanup targets are the still-present legacy backend, package-manager inconsistency, and the oversized `ScenarioApp.tsx`.

The second conclusion is operational. The local dev loop does work with Go plus Vite in separate processes, but the port story is easy to confuse when multiple local servers are already running. During validation, the Go server bound to `:3001` and the Vite dev server moved to `:3003` because `:3000`, `:3001`, and `:3002` were already occupied on the machine.

### Prompt Context

**User prompt (verbatim):** "How can I run with pnpm dev + server? Try in tmux. Also, what can we simplify in the codebase, and can we split the UI into a more modular code? 

Create a new docmgr cleanup ticket, and create a detailed analysis / design / review / implementation guide that is very detailed for a new intern, explaining all the parts of the system needed to understand what it is, with prose paragraphs and bullet point sand pseudocode and diagrams and api references and file
  references.
  It should be very clear and detailed. Store in the ticket and the nupload to remarkable."

**Assistant interpretation:** Create a fresh cleanup ticket, verify the real development workflow with Go plus `pnpm dev`, analyze backend and frontend simplification opportunities in the current codebase, and write a detailed intern-facing guide that is stored in the ticket and uploaded to reMarkable.

**Inferred user intent:** Reduce architectural confusion around the new scenario runtime, make the system easier to run locally, and create a durable onboarding document before doing further cleanup work.

**Commit (code):** N/A — documentation and validation only

### What I did
- Created the new ticket workspace `SCENARIO-CLEANUP-001`.
- Inspected the current active path in `cmd/pod-demo/main.go`, `cmd/scenario-demo/main.go`, `internal/app/app.go`, `internal/scenario/runtime/session.go`, `internal/scenario/runtime/vm.go`, `internal/scenario/server/handler.go`, `internal/events/hub.go`, `ui/src/ScenarioApp.tsx`, `ui/vite.config.ts`, `ui/package.json`, `internal/web/generate_build.go`, `internal/server/handler.go`, and `internal/system/service.go`.
- Validated `pnpm` and `tmux` availability locally.
- Retried the `tmux` launch outside the sandbox after the sandbox blocked the socket.
- Started a real `tmux` session with `go run ./cmd/pod-demo` and `pnpm dev`.
- Verified the running ports with `ss -ltnp | rg ':3000|:3001|:3002|:3003'`.
- Verified the Go health endpoint and Vite root outside the sandbox with `curl`.
- Wrote the detailed intern-facing cleanup and modularization guide.
- Updated the ticket index, tasks, and changelog.

### Why
- The repo now contains a solid scenario runtime, but the surrounding codebase still tells a more confusing story than necessary.
- The user explicitly wanted the real dev loop tested in `tmux`, not just inferred from config files.
- A detailed guide is more useful to an intern if it explains both the good architecture and the cleanup debt at the same time.

### What worked
- `pnpm` was installed and available.
- `tmux` was installed and available.
- Launching the two-process session outside the sandbox worked.
- The Go server answered `GET /api/healthz` with `{"status":"ok"}`.
- The Vite dev server responded with `HTTP/1.1 200 OK`.
- The current codebase gave enough line-anchored evidence to write a concrete guide instead of a generic cleanup memo.

### What didn't work
- A direct sandboxed `tmux` call failed earlier with:

```text
error connecting to /tmp/tmux-1000/default (Operation not permitted)
```

- Local HTTP checks from inside the sandbox failed with `curl` exit code `7` until rerun outside the sandbox.
- The Vite dev server did not stay on port `3000` during validation because the host machine already had listeners on `3000`, `3001`, and `3002`.

### What I learned
- The new scenario stack is the real product architecture. The old pod-demo backend is now mostly a repository hygiene problem.
- The current UI is the single biggest maintenance hotspot. The design direction is good, but the file boundary is poor.
- The JS toolchain inconsistency is not theoretical. The codebase currently asks for `pnpm dev` while the embed build still hard-codes `npm`.

### What was tricky to build
- The main operational wrinkle was the sandbox boundary. `tmux` sockets and loopback HTTP checks behaved differently inside and outside the sandbox, so validation had to be retried with escalation.
- The main documentation wrinkle was keeping the recommendations evidence-backed. The codebase has both active and legacy paths, so every recommendation had to clearly distinguish "currently used" from "still present but likely stale."

### What warrants a second pair of eyes
- The decision about whether to keep `cmd/pod-demo` or `cmd/scenario-demo` as the canonical binary name.
- The decision about whether to archive or delete the old pod-demo backend.
- The decision about whether the team wants `pnpm` as a real standard or just a local convenience.

### What should be done in the future
- Implement the cleanup phases in focused steps rather than one large refactor.
- Split `ScenarioApp.tsx` before making further UI feature changes.
- Standardize the package manager before editing the embed build again.
- Add a repo-supported `tmux` or `make dev` command.

### Code review instructions
- Start with `internal/app/app.go`, `internal/scenario/runtime/session.go`, `internal/scenario/server/handler.go`, and `ui/src/ScenarioApp.tsx`.
- Compare those files with `internal/server/handler.go` and `internal/system/service.go` to see the active-versus-legacy split.
- Read the primary guide after looking at the code so the cleanup recommendations map cleanly onto the actual architecture.
- Reproduce the dev loop with the documented `tmux` commands and confirm which ports are in use on the local machine.

### Technical details

Commands used during investigation:

```bash
which pnpm
pnpm --version
tmux -V
tmux new-session -d -s scenario-cleanup-dev -c /home/manuel/code/wesen/2026-03-13--pod-deployment-demo 'go run ./cmd/pod-demo'
tmux new-window -t scenario-cleanup-dev -c /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui 'pnpm dev'
tmux list-windows -t scenario-cleanup-dev -F '#S:#I #{window_name} #{window_active} #{window_panes}'
tmux capture-pane -pt scenario-cleanup-dev:1
ss -ltnp | rg ':3000|:3001|:3002|:3003'
curl -s http://127.0.0.1:3001/api/healthz
curl -I -s http://127.0.0.1:3003
```

## Step 2: Reproduce The Empty Snapshot And Slider Reset Bugs

The earlier cleanup guide was not enough for the two concrete runtime failures the user reported, so this step narrowed those failures down to exact code paths. The result was that the `JSON.parse` error is not a generic frontend parsing bug. It is a backend snapshot-encoding failure that leaks to the frontend because the server returns `200 OK` with an empty body when JSON encoding fails.

The second result was that the slider reset is a separate semantic bug in the `Session` implementation. `UpdateSpec()` rebuilds the published snapshot from an empty `buildSnapshot()`, so the UI is faithfully rendering a backend-authored reset view.

### Prompt Context

**User prompt (verbatim):** "Does this address Uncaught SyntaxError: JSON.parse: unexpected end of data at line 1 column 1 of the JSON data
    connect ScenarioApp.tsx:689
    connect ScenarioApp.tsx:687
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680
    connect ScenarioApp.tsx:683
    connect ScenarioApp.tsx:680


also the state resets in the UI (and prob background) every time I moved a slider in the UI. 

If not, research, create a second report, upload too."

**Assistant interpretation:** Verify whether the earlier cleanup report actually covers the live parse and reset failures; if not, reproduce them, identify the root causes, and write a second focused report.

**Inferred user intent:** Turn vague runtime instability into concrete, fixable engineering findings instead of hand-wavy cleanup commentary.

**Commit (code):** N/A — documentation and investigation only

### What I did
- Re-read `ui/src/ScenarioApp.tsx`, `internal/scenario/server/handler.go`, and `internal/scenario/runtime/session.go` against the reported stack trace.
- Used Playwright against the live dev server to confirm the browser was receiving empty WebSocket data and throwing `JSON.parse` errors.
- Confirmed that `GET /api/session/snapshot` could return `200 OK` with `Content-Length: 0`.
- Started a fresh server instance on `:3101` to separate a clean session from the already-mutated live session.
- Drove the fresh server through preset switches and multiple steps until `zombie-fleet` reproduced the empty snapshot on the second tick.
- Created `scripts/inspect_snapshot.go` inside the ticket to directly marshal session state and confirm the exact backend error: `json: unsupported value: NaN`.
- Traced the `NaN` back to `scenarios/zombie-fleet/observe.js`, where `current.walls || 1` revives a legitimate zero wall count and later creates `NaN` wall health.
- Confirmed the slider reset comes from `Session.UpdateSpec()` assigning `s.last = s.buildSnapshot()`.
- Wrote the focused bug report in `design-doc/02-bug-report-for-json-parse-failures-and-slider-driven-state-resets.md`.

### Why
- The user was right that the original cleanup doc did not address these concrete defects.
- The repo needed an artifact that separates general cleanup advice from immediate runtime breakage.

### What worked
- Playwright reproduced the browser-side parse failure.
- Direct HTTP checks showed the empty response body clearly.
- The fresh-server repro on `:3101` isolated the issue to `zombie-fleet` tick progression.
- The temporary Go inspection script proved the failure mode with a concrete marshal error.

### What didn't work
- The first clue, the browser stack trace, was not enough by itself to identify whether the transport failure started in the UI, the WebSocket proxy, or the backend.
- A direct scratch Go program under `/tmp` failed because it could not import the repo’s `internal` packages:

```text
use of internal package github.com/manuel/wesen/pod-deployment-demo/internal/events not allowed
```

- I moved that inspection program into the ticket `scripts/` directory to keep it inside the module boundary.

### What I learned
- `zombie-fleet` has a classic JavaScript truthiness bug around zero-valued numeric state.
- The current Go JSON writer hides encoder failures far too well.
- The slider reset is caused by backend snapshot semantics, not just frontend rendering behavior.

### What was tricky to build
- The bug only reproduced once the session had reached a certain preset state, so a clean server and a mutated live server behaved differently.
- The parse error looked frontend-local at first, but the decisive evidence came from checking response bodies and direct Go JSON marshaling.

### What warrants a second pair of eyes
- Whether the Go host should validate `NaN`/`Inf` in snapshot payloads as a last line of defense.
- Whether `UpdateSpec()` should only preserve visible state or also trigger an immediate recompute.

### What should be done in the future
- Implement the bug fixes before assuming the cleanup ticket is only about architecture polish.
- Add regression tests that assert non-empty valid JSON bodies across multi-step scenario execution.

### Code review instructions
- Start with `scenarios/zombie-fleet/observe.js`, `internal/scenario/server/handler.go`, and `internal/scenario/runtime/session.go`.
- Run the temporary inspection script if you want a direct marshal proof.
- Compare the bug report with the earlier broad cleanup guide to see why this second report was necessary.

### Technical details

Commands and probes used:

```bash
curl -i -s http://127.0.0.1:3001/api/session/snapshot
curl -i -s http://127.0.0.1:3001/api/session/spec
curl -i -s -X POST http://127.0.0.1:3001/api/session/run -H 'Content-Type: application/json' -d '{}'
tmux new-session -d -s scenario-bug-repro -c /home/manuel/code/wesen/2026-03-13--pod-deployment-demo 'env ADDR=:3101 go run ./cmd/pod-demo'
go run ./ttmp/2026/03/13/SCENARIO-CLEANUP-001--cleanup-and-modularization-plan-for-scenario-runtime-and-workbench/scripts/inspect_snapshot.go
```

Key findings:

```text
snapshot 2 marshal err: json: unsupported value: NaN
step zombie-fleet 2 200 0
```

## Step 3: Add The Go-Focused Architecture Review And Publish The Expanded Ticket Bundle

After the bug report, the next task was to write the Go-specific review the user asked for: not another frontend or runtime symptom memo, but a review of architectural elegance, consistency, idiomatic code, duplicated or deprecated code, and file organization. The important outcome from that review is that the active scenario backend is already the right center of gravity, but the repository still tells that story poorly because the legacy pod-demo code remains in generic top-level packages.

The Go review also captured a more subtle architectural problem: the generic event hub currently depends on the legacy `internal/domain.Event` type. That coupling makes the active scenario architecture look more entangled with deprecated code than it should be.

### Prompt Context

**User prompt (verbatim):** "you have full access. 

Once you're done, create a new document that reviews the go code in particular around architectural elegance, consistency, idiomatic code, deprecated or duplicated code, file organization. The fundamental abstractions should be clear.

Create a detailed review document and store in ticket and upload to remarkable"

**Assistant interpretation:** Finish the bug-report pass, then add a separate detailed Go architecture review document to the same cleanup ticket and upload the expanded bundle.

**Inferred user intent:** Make the cleanup ticket useful not just for fixing one bug, but for guiding a broader Go backend simplification effort with clear abstractions and file-organization decisions.

**Commit (code):** N/A — documentation and upload only

### What I did
- Inventoried the Go tree across `cmd/` and `internal/`.
- Re-read the active scenario packages, the app bootstrap, the event hub, the web embed pipeline, and the legacy pod-demo packages.
- Wrote `design-doc/03-go-architecture-review-for-scenario-runtime-cleanup.md` with clear abstraction mapping and concrete cleanup sketches.
- Updated the ticket index, task list, and changelog to include the bug report and the Go review.
- Prepared the expanded reMarkable upload bundle.

### Why
- The bug report is tactical; the Go review is structural.
- The user explicitly wanted the Go abstractions, consistency, duplication, and file organization reviewed in detail.

### What worked
- The active scenario architecture reviews cleanly once isolated.
- The duplication and coupling issues are concrete and easy to point at with file references.

### What didn't work
- The repository still requires readers to mentally subtract the old pod-demo stack before the active architecture becomes obvious.

### What I learned
- The `internal/scenario/*` packages are better than the repository layout makes them look.
- The event envelope living in `internal/domain` is a small but important architectural leak.

### What was tricky to build
- The trick was to review the code without flattening everything into generic “clean code” advice. The useful review is the one that clarifies what should remain central and what should move out of the main conceptual path.

### What warrants a second pair of eyes
- Whether the team wants to preserve the old pod-demo code as a legacy example.
- Whether the event model should stay generic or move closer to a scenario-specific contract.

### What should be done in the future
- Implement the Go cleanup in small steps, with path cleanup before large behavioral changes.

### Code review instructions
- Read `design-doc/03-go-architecture-review-for-scenario-runtime-cleanup.md`.
- Follow its references into `internal/app`, `internal/events`, `internal/scenario`, and the legacy packages.
- Compare the proposed target layout with the current `internal/` tree.

### Technical details

Inventory commands used:

```bash
rg --files cmd internal | sort
find internal -maxdepth 2 -type d | sort
```

## Step 4: Convert The Cleanup Ticket Into An Execution Plan

The analysis phase is done, so this step converts the ticket into an implementation queue. The goal is to prevent the cleanup from devolving into a giant mixed refactor. The work is being sliced into runtime-contract fixes first, then active-backend simplification, then UI modularization, then build/dev workflow cleanup.

That ordering is deliberate. The runtime bugs are causing live failures now, so they need to land before any structural cleanup claims are credible. After that, the repository can safely shed the old pod-demo backend and tighten the active scenario architecture without mixing behavioral breakage and file-layout churn in the same change.

### Prompt Context

**User prompt (verbatim):** "Add tasks to clean all of this up, you can just kill legacy stuff. 

Then execute the tasks one by one, commit as you go, keep a diary."

**Assistant interpretation:** Turn the cleanup findings into a granular implementation plan, then execute the plan in focused code-and-doc commits while maintaining the ticket diary.

**Inferred user intent:** Finish the cleanup end to end instead of stopping at analysis, and make the history reviewable by slicing the work into clear steps.

**Commit (code):** pending

### What I did
- Re-checked the working tree to identify unrelated local changes that should not be staged.
- Re-ran the baseline `go test ./... -count=1` and frontend typecheck before beginning cleanup.
- Reworked `tasks.md` into a granular execution list covering runtime fixes, legacy removal, UI modularization, and build/dev workflow cleanup.
- Prepared a multi-step implementation sequence so each change can be committed and reviewed independently.

### Why
- The ticket needed to shift from “what should happen” to “what is being done now.”
- The user explicitly allowed deleting legacy code, which simplifies the backend cleanup path materially.

### What worked
- Baseline Go tests passed before cleanup work started.
- The ticket already contained enough evidence to define a concrete implementation sequence.

### What didn't work
- The working tree was not clean at the start, so staging will need to stay deliberate to avoid pulling in unrelated local changes.

### What I learned
- The cleanup work is broad enough that task ordering matters more than task count.
- Killing the legacy backend simplifies several other cleanup decisions at once.

### What was tricky to build
- The main constraint is keeping commits focused while code, docs, and generated assets all move together.

### What warrants a second pair of eyes
- Whether any downstream local scripts still assume `cmd/pod-demo` instead of `cmd/scenario-demo`.
- Whether the legacy pod-demo backend has any intentionally preserved reference value before deletion.

### What should be done in the future
- Execute the cleanup steps in the order captured in `tasks.md`.

### Code review instructions
- Read the updated `tasks.md` first.
- Compare the execution order there with the earlier analysis docs to understand why the implementation sequence is structured this way.

### Technical details

Baseline commands run before implementation:

```bash
git status --short
go test ./... -count=1
npm --prefix ui run typecheck
```

## Step 5: Fix The Live Runtime Contract Bugs

This step fixed the immediate breakage we had already reproduced in the ticket. The backend was able to return `200 OK` with an empty body when JSON encoding failed, `zombie-fleet` could generate `NaN` snapshot values on the second tick, and `Session.UpdateSpec()` reset the published runtime view on every slider change. Those three issues are tightly related at the user experience level, so they were fixed as one runtime-contract slice.

The implementation stayed narrow on purpose. I did not start the broader backend cleanup or the UI modular split here. The goal of this commit was to make the existing runtime honest and stable before reorganizing the code around it.

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Start the execution phase with the runtime bugs that were already confirmed in the previous investigation step.

**Inferred user intent:** Make the existing app stop lying to the UI and stop breaking under normal scenario interaction before moving on to architectural cleanup.

**Commit (code):** `81851c4` — `fix(runtime): harden snapshot updates and zombie fleet`

### What I did
- Updated `scenarios/zombie-fleet/observe.js` to preserve legitimate zero values instead of reviving them with truthy fallbacks.
- Guarded zombie wall damage logic so it cannot turn missing wall HP into `NaN`.
- Changed `internal/scenario/server/handler.go` so JSON responses are marshaled before headers are written and return an HTTP 500 on encoding failure.
- Changed `internal/scenario/runtime/session.go` so `UpdateSpec()` preserves the current snapshot view and only updates `Desired`.
- Added runtime regression tests that keep `zombie-fleet` JSON-encodable across multiple steps.
- Added server regression tests that require non-empty valid JSON for snapshot responses.

### Why
- The current live failures were rooted in runtime semantics and transport behavior, not cosmetic UI issues.
- Fixing these first reduces noise for every later cleanup step.

### What worked
- The focused runtime and server tests passed after the changes.
- The fix keeps the runtime behavior intuitive: desired-state edits no longer masquerade as resets.

### What didn't work
- N/A

### What I learned
- A small scenario-state bug becomes much harder to debug when the transport layer hides serialization errors.
- Preserving snapshot semantics in `UpdateSpec()` matters as much as the correctness of the scenario logic itself.

### What was tricky to build
- The server-side JSON failure was easy to paper over accidentally because the previous implementation wrote the status code before attempting to encode the body.
- The scenario bug depended on zero being a legitimate value, which is exactly where JavaScript truthiness shortcuts become dangerous.

### What warrants a second pair of eyes
- Whether the UI should also defensively guard against empty or malformed WebSocket frames even after the backend fix.
- Whether the runtime should explicitly validate outgoing snapshots for JSON-unsafe values as an additional safety net.

### What should be done in the future
- Continue with the active-backend cleanup now that the runtime contract is stable.

### Code review instructions
- Start with `scenarios/zombie-fleet/observe.js`, `internal/scenario/server/handler.go`, and `internal/scenario/runtime/session.go`.
- Then read the new regression coverage in `internal/scenario/runtime/session_test.go` and `internal/scenario/server/handler_test.go`.

### Technical details

Validation commands:

```bash
go test ./internal/scenario/... -count=1
go test ./internal/app -count=1
```

## Step 6: Remove The Legacy Pod-Demo Backend And Clarify The Active Go Architecture

With the runtime contract stable, the next cleanup slice removed the dead architecture instead of continuing to document around it. This step made `cmd/scenario-demo` the only server entrypoint, deleted the old pod-demo backend packages, moved the generic event envelope into `internal/events`, and pulled app config/path logic into explicit helpers so `internal/app/app.go` could stay focused on assembly.

This is the slice where the repository finally starts matching the story in the analysis docs. Before this commit, an intern still had to mentally subtract the old controller/worker/service stack. After this commit, the codebase points much more directly at the actual scenario runtime.

### Prompt Context

**User prompt (verbatim):** (see Step 4)

**Assistant interpretation:** Execute the structural backend cleanup now that the runtime behavior is repaired, and remove the legacy code instead of preserving it.

**Inferred user intent:** Make the repository reflect the real architecture, not just the docs.

**Commit (code):** `8964c82` — `refactor(backend): remove legacy pod demo stack`

### What I did
- Deleted `cmd/pod-demo/main.go`.
- Deleted the legacy pod-demo packages under `internal/controller`, `internal/domain`, `internal/server`, `internal/state`, `internal/system`, and `internal/worker`.
- Added `internal/events/event.go` so the event envelope no longer depends on the deleted legacy `internal/domain` package.
- Added `internal/project/project.go` for repo-root and scenarios-dir discovery.
- Added `internal/app/config.go` with an explicit `Config` surface for `ADDR` and `SCENARIOS_DIR`.
- Refactored `internal/app/app.go` so `New()` loads config and `NewWithConfig()` performs dependency assembly.
- Updated `internal/web/generate_build.go` to reuse the shared project path helper.

### Why
- The old pod-demo stack was no longer part of the active product architecture.
- Leaving generic legacy packages in place made the repository harder to understand than it needed to be.
- Extracting config/path helpers at the same time kept the surviving backend shape clean and reviewable.

### What worked
- The full Go test suite passed after the legacy tree was removed.
- The active scenario runtime needed only a small amount of new shared infrastructure to stand alone cleanly.

### What didn't work
- N/A

### What I learned
- The strongest cleanup step was deletion. Several architectural ambiguities vanished immediately once the old tree was removed.
- Moving the event envelope out of the legacy domain package simplified the mental model more than its line count suggests.

### What was tricky to build
- The main risk was accidentally deleting something still referenced indirectly. Running `rg` across `cmd` and `internal` before removal was the important guardrail.
- The shared path helper had to be placed somewhere neutral enough that both the app package and the web build helper could use it without importing unrelated runtime concerns.

### What warrants a second pair of eyes
- Whether any external scripts or habits outside the repo still assume `cmd/pod-demo`.
- Whether `internal/project` is the preferred long-term home for repo-root discovery, or whether the team wants a different package name.

### What should be done in the future
- Continue with the UI modularization and build-workflow cleanup now that the backend tree is materially simpler.

### Code review instructions
- Start with `internal/events/event.go`, `internal/events/hub.go`, `internal/app/config.go`, `internal/project/project.go`, and `internal/app/app.go`.
- Then review the deletions to confirm the old pod-demo stack is fully gone.
- Finish with `go test ./... -count=1`.

### Technical details

Validation commands:

```bash
go test ./... -count=1
rg -n "cmd/pod-demo|internal/server|internal/system|internal/controller|internal/state|internal/worker|internal/domain" cmd internal -S
```

## Usage Examples

Use this diary when continuing the cleanup work:

1. Read the primary guide for the target architecture.
2. Use the task list to pick the next cleanup step.
3. Re-run the `tmux` workflow if you need a live local environment.
4. Update this diary with the next implementation step, commit hash, failures, and validation evidence.

## Related

- `../design-doc/01-intern-guide-to-cleanuping-the-scenario-runtime-and-workbench.md`
- `../tasks.md`
- `../changelog.md`
