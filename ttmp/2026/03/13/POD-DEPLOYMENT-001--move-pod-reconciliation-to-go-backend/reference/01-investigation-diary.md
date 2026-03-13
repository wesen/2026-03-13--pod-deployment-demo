---
Title: Investigation Diary
Ticket: POD-DEPLOYMENT-001
Status: active
Topics:
    - backend
    - frontend
    - websocket
    - architecture
DocType: reference
Intent: long-term
Owners: []
RelatedFiles:
    - Path: ../../../../../../../../../../../tmp/pod-deployment.jsx
      Note: Original source lookup and analysis trail
    - Path: cmd/pod-demo/main.go
      Note: Binary entrypoint added in implementation step 3 (commit 0eb5c49a40129a44b263d6b8c520206e64663b42)
    - Path: go.mod
      Note: Introduced the Go module for implementation step 3 (commit 0eb5c49a40129a44b263d6b8c520206e64663b42)
    - Path: internal/app/app.go
      Note: HTTP server lifecycle wiring added in implementation step 3 (commit 0eb5c49a40129a44b263d6b8c520206e64663b42)
    - Path: internal/controller/controller.go
      Note: Reconciliation loop introduced in step 4 (commit ad91f61f68cf01b307cb5e772e4f2d41724b069b)
    - Path: internal/domain/model.go
      Note: Domain contracts introduced in step 4 (commit ad91f61f68cf01b307cb5e772e4f2d41724b069b)
    - Path: internal/events/hub.go
      Note: WebSocket event fan-out introduced in step 4 (commit ad91f61f68cf01b307cb5e772e4f2d41724b069b)
    - Path: internal/server/handler.go
      Note: |-
        Initial API handler scaffold added in implementation step 3 (commit 0eb5c49a40129a44b263d6b8c520206e64663b42)
        HTTP and WebSocket endpoints introduced in step 4 (commit ad91f61f68cf01b307cb5e772e4f2d41724b069b)
    - Path: internal/server/handler_test.go
      Note: |-
        Health endpoint coverage added in implementation step 3 (commit 0eb5c49a40129a44b263d6b8c520206e64663b42)
        Backend endpoint coverage expanded in step 4 (commit ad91f61f68cf01b307cb5e772e4f2d41724b069b)
    - Path: internal/state/store.go
      Note: In-memory source of truth introduced in step 4 (commit ad91f61f68cf01b307cb5e772e4f2d41724b069b)
    - Path: internal/system/service.go
      Note: System orchestration introduced in step 4 (commit ad91f61f68cf01b307cb5e772e4f2d41724b069b)
    - Path: internal/worker/manager.go
      Note: Goroutine worker manager introduced in step 4 (commit ad91f61f68cf01b307cb5e772e4f2d41724b069b)
    - Path: internal/worker/worker.go
      Note: Worker lifecycle simulation introduced in step 4 (commit ad91f61f68cf01b307cb5e772e4f2d41724b069b)
    - Path: ttmp/2026/03/13/POD-DEPLOYMENT-001--move-pod-reconciliation-to-go-backend/sources/local/Original React Pod Deployment Demo.jsx
      Note: Imported source snapshot referenced by this diary
ExternalSources: []
Summary: Chronological investigation notes for the pod deployment demo ticket, including source discovery, missing-input resolution, and architecture conclusions.
LastUpdated: 2026-03-13T13:23:34.050949865-04:00
WhatFor: ""
WhenToUse: ""
---




# Investigation Diary

## Goal

Capture the investigation that produced the backend/WebSocket architecture recommendation for the pod deployment demo ticket.

## Step 1: Establish The Source Of Truth And Draft The Architecture

I created a local `docmgr` workspace in this repository, opened the provided demo input, and used the imported source as the evidence base for the design recommendation. The main technical goal was to separate what the current React file actually does from what the requested Go backend design should do.

The main discovery was that the requested file path did not exist as written. The source was present as `/tmp/pod-deployment.jsx`, not `/tmp/pod-deployment.tsx`, so the ticket records that mismatch and uses the imported `.jsx` file as the traceable artifact for the analysis.

### Prompt Context

**User prompt (verbatim):**

```text
Create a docmgr ticket, import /tmp/pod-deployment.tsx with docmgr import file --file /tmp/pod-deployment.tsx --ticket ... 

Create design doc, analyze code: 

- move pods + reconciliation algorith to a go backend, workers as goroutines
- websocket to react frontend

After analysis, suggest what protocol the workers use to main: watermill events? http?
```

**Assistant interpretation:** Create a local `docmgr` ticket, import the provided pod deployment source, analyze the current implementation, and write a design document for a Go backend plus React WebSocket frontend.

**Inferred user intent:** Turn the current single-file frontend demo into an architecture plan with cleaner runtime boundaries and a justified recommendation for internal worker communication.

**Commit (code):** N/A

### What I did

- Ran `docmgr init --root ttmp --seed-vocabulary` to create a local docs root inside the repo.
- Ran `docmgr ticket create-ticket --root ttmp --ticket POD-DEPLOYMENT-001 --title "Move Pod Reconciliation To Go Backend" --topics backend,frontend,websocket,architecture`.
- Added the primary design doc and this diary doc with `docmgr doc add`.
- Tried to read `/tmp/pod-deployment.tsx`, then located the actual source as `/tmp/pod-deployment.jsx`.
- Imported `/tmp/pod-deployment.jsx` into the ticket with `docmgr import file --root ttmp --ticket POD-DEPLOYMENT-001 --file /tmp/pod-deployment.jsx --name "Original React Pod Deployment Demo"`.
- Read the imported source and anchored the design doc to the observed React state, reconcile loop, chaos mode, and UI layout.

### Why

- The ticket needed a stable local workspace because the repository had no existing `ttmp/` root.
- The design had to be evidence-based. The user asked for architectural analysis, so the current code needed to be read closely before recommending protocols or backend boundaries.
- Importing the source into the ticket makes the design reviewable even if the original `/tmp` file is later removed.

### What worked

- `docmgr` initialized cleanly in the repo and created the requested ticket workspace.
- The missing `.tsx` file was resolved quickly by scanning `/tmp` and finding `/tmp/pod-deployment.jsx`.
- The current code was sufficiently self-contained to support a high-confidence recommendation: a Go backend authority, WebSocket event stream to React, and typed in-process channels between controller and workers.

### What didn't work

- Reading the path from the prompt failed because the file did not exist:

```text
$ sed -n '1,260p' /tmp/pod-deployment.tsx
sed: can't read /tmp/pod-deployment.tsx: No such file or directory
```

```text
$ wc -l /tmp/pod-deployment.tsx
wc: /tmp/pod-deployment.tsx: No such file or directory
```

- A broad `find /tmp ...` search produced permission-noise from system temp directories before I switched to `rg --files /tmp 2>/dev/null`:

```text
find: ‘/tmp/systemd-private-...’: Permission denied
find: ‘/tmp/snap-private-tmp’: Permission denied
```

### What I learned

- The demo is conceptually strong because it already separates the reconcile phases in the UI, but operationally everything still lives in one React component.
- The user’s worker-as-goroutine requirement rules out HTTP as the primary controller-to-worker mechanism unless the design is intentionally pretending those goroutines are remote services.
- Watermill is not justified by the current problem shape. There is no evidence in the imported file of durability, broker integration, or multi-process consumers.

### What was tricky to build

- The tricky part was not implementation complexity but source validation. The prompt referenced a `.tsx` file that did not exist, so there was a risk of writing a speculative design without actual evidence. I resolved that by searching for the likely filename variant, confirming `/tmp/pod-deployment.jsx`, and importing that file into the ticket before drafting conclusions.

### What warrants a second pair of eyes

- The initial browser-to-backend command split: HTTP for mutations and WebSocket for events is my recommended default, but the team may prefer a fully duplex WebSocket protocol for demo simplicity.
- The worker scheduling policy is intentionally under-specified. If the demo needs believable node behavior, the scheduler and worker capacity model will matter.
- If persistence or replay is a hidden requirement, the recommendation against Watermill may need revisiting.

### What should be done in the future

- Build the Go runtime skeleton and make the frontend consume a real `snapshot` plus delta event contract.
- Decide whether reconnect semantics require full snapshot replay or resumable event offsets.
- Add backend tests for reconcile diff logic and worker lifecycle sequencing.

### Code review instructions

- Start with `/tmp/pod-deployment.jsx:77-205` to see the current runtime logic that the design doc proposes moving into Go.
- Then review the design doc in `design-doc/01-backend-reconciliation-and-websocket-architecture.md` for the proposed backend boundary, transport contract, and protocol recommendation.
- Validate the ticket contents with `docmgr doctor --root ttmp --ticket POD-DEPLOYMENT-001 --stale-after 30`.

### Technical details

- Ticket ID: `POD-DEPLOYMENT-001`
- Imported source: `sources/local/Original React Pod Deployment Demo.jsx`
- Recommended worker protocol: typed in-process Go channels with command/event structs
- Rejected worker protocols for the first version: HTTP between goroutines, Watermill without a real broker/distribution requirement

## Step 2: Upload The First Bundle And Expand The Ticket For Intern Onboarding

After the first design doc was uploaded to reMarkable, the user asked for a much more detailed guide aimed at a new intern. I treated that as a request to keep the original concise document for handoff continuity, then add a second, more explanatory design document that slows down and explains each subsystem, concept, and implementation phase in more depth.

The second document focuses on teaching value. It explains what the current React file is actually doing, what a reconciliation system is, why the controller/worker split exists, what transport contracts are needed, which files should exist in a future implementation, and why typed Go channels are the right worker protocol for this system size.

### Prompt Context

**User prompt (verbatim):** (see Step 1)

**Assistant interpretation:** First finish the existing upload to reMarkable, then create a more detailed design and implementation guide in the same ticket and upload that version as well.

**Inferred user intent:** Produce a deliverable that a new engineer can read as onboarding material, not just as a terse architecture note.

**Commit (code):** N/A

### What I did

- Verified the interrupted upload state with `remarquee cloud ls /ai/2026/03/13/POD-DEPLOYMENT-001 --long --non-interactive`.
- Uploaded the original ticket bundle successfully with:

```text
remarquee upload bundle /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/POD-DEPLOYMENT-001--move-pod-reconciliation-to-go-backend/index.md /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/POD-DEPLOYMENT-001--move-pod-reconciliation-to-go-backend/design-doc/01-backend-reconciliation-and-websocket-architecture.md /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/POD-DEPLOYMENT-001--move-pod-reconciliation-to-go-backend/reference/01-investigation-diary.md --name "POD-DEPLOYMENT-001 Pod Reconciliation Backend Design" --remote-dir "/ai/2026/03/13/POD-DEPLOYMENT-001" --toc-depth 2
```

- Verified the uploaded PDF existed in the remote folder.
- Added a second design doc: `design-doc/02-intern-guide-to-the-pod-reconciliation-system.md`.
- Wrote a much more detailed system guide with diagrams, API references, conceptual explanations, pseudocode, and proposed implementation files.
- Uploaded the updated bundle containing the intern guide as `POD-DEPLOYMENT-001 Intern Guide And Design Bundle`.
- Verified that both PDFs existed in `/ai/2026/03/13/POD-DEPLOYMENT-001`.

### Why

- The first design doc is useful as a concise architecture decision record, but it is not optimal as onboarding material.
- A new intern needs more narrative explanation, more explicit definitions, and more implementation scaffolding.
- Keeping the second document in the same ticket makes the terse and detailed versions live together.

### What worked

- The existing upload completed successfully after the interruption.
- The ticket already had enough evidence to support a more expansive guide without inventing unsupported details.
- The second guide now gives both a high-level overview and a concrete file-by-file implementation roadmap.
- The updated intern-guide bundle uploaded successfully and now sits alongside the original concise bundle.

### What didn't work

- The earlier turn interruption terminated a running upload attempt, so I had to re-check remote state before continuing.
- `remarquee cloud ls /ai/2026/03/13/POD-DEPLOYMENT-001 --long --non-interactive` initially showed the folder without the PDF, which implied the first upload command had not completed before interruption.

### What I learned

- For long-form onboarding docs, the most useful additions are usually conceptual definitions, responsibility boundaries, and stepwise flows, not just more words.
- It is worth separating a "decision memo" from an "intern guide" even when both describe the same system.

### What was tricky to build

- The tricky part was maintaining continuity after the interrupted turn. The remote ticket directory already existed, but the PDF bundle had not been verified inside it. I resolved that by checking the remote listing first, then re-running the actual bundle upload before writing the new document.

### What warrants a second pair of eyes

- The proposed file layout is intentionally suggested rather than derived from an existing backend tree, because the repository currently has no Go service files.
- If the eventual implementation uses a different web stack or frontend folder layout, the proposed file plan should be adjusted before coding starts.

### What should be done in the future

- If implementation begins, keep the intern guide updated with actual file paths rather than only proposed ones.

### Code review instructions

- Review `design-doc/02-intern-guide-to-the-pod-reconciliation-system.md` for tone, completeness, and onboarding clarity.
- Confirm both uploaded PDFs exist remotely in `/ai/2026/03/13/POD-DEPLOYMENT-001`.
- Run `docmgr doctor --root ttmp --ticket POD-DEPLOYMENT-001 --stale-after 30` after bookkeeping updates.

### Technical details

- First uploaded PDF: `POD-DEPLOYMENT-001 Pod Reconciliation Backend Design`
- Second uploaded PDF: `POD-DEPLOYMENT-001 Intern Guide And Design Bundle`
- Remote folder: `/ai/2026/03/13/POD-DEPLOYMENT-001`
- New expanded guide: `design-doc/02-intern-guide-to-the-pod-reconciliation-system.md`

## Step 3: Scaffold The Go Service And Ticket Execution Tasks

The repository had no implementation code when this step started, only the docmgr workspace and imported source snapshot. I converted the design ticket into executable tasks and built the thinnest viable Go service first so the next steps can add runtime logic on top of a working binary rather than on top of an empty repository.

This step intentionally kept scope narrow. It created a Go module, a binary entrypoint, application wiring, a minimal HTTP handler, and a health test. That gives the ticket a real codebase and a first green test run, while keeping the first implementation commit focused and reviewable.

### Prompt Context

**User prompt (verbatim):** "Add tasks to the ticket, build them one by one, commit as you go, keep a diary."

**Assistant interpretation:** Convert the design work into tracked implementation tasks, start building the system in small increments, make focused commits after each increment, and keep the docmgr diary synchronized with the code history.

**Inferred user intent:** Move from architecture-only work into disciplined execution with visible progress, commit hygiene, and continuation-friendly notes.

**Commit (code):** 0eb5c49a40129a44b263d6b8c520206e64663b42 — "feat(backend): scaffold pod demo service"

### What I did

- Added implementation tasks to the ticket for scaffolding, backend runtime, frontend integration, and validation.
- Created `go.mod`.
- Added `cmd/pod-demo/main.go` as the binary entrypoint.
- Added `internal/app/app.go` for server lifecycle wiring.
- Added `internal/server/handler.go` with `/api/healthz` and a placeholder root handler.
- Added `internal/server/handler_test.go` to validate the health endpoint.
- Ran:

```text
gofmt -w cmd/pod-demo/main.go internal/app/app.go internal/server/handler.go internal/server/handler_test.go
go test ./... -count=1
git commit -m "feat(backend): scaffold pod demo service"
```

### Why

- A narrow scaffold commit is the cleanest foundation for the more complex controller and WebSocket work.
- The repository needed a real module and runnable binary before any runtime architecture could be encoded.
- The ticket needed explicit implementation tasks so progress could be tracked and checked off as requested.

### What worked

- The initial Go module compiled and tested without external dependencies.
- The first commit established a clean baseline for the rest of the build.
- The task list now reflects actual implementation work instead of only documentation work.

### What didn't work

- The existing task list numbering had shifted because earlier completed documentation tasks remained in the file, so I had to re-read the current list before checking the new implementation task.

### What I learned

- Starting with the smallest runnable slice keeps the first code review trivial and reduces risk when the runtime step gets much larger.
- The ticket task list is now the control surface for the rest of the implementation loop.

### What was tricky to build

- The main subtlety was sequencing rather than code complexity. The user asked for "commit as you go" and "keep a diary," which means each implementation slice has to stay small enough that code, tests, ticket bookkeeping, and diary updates can all happen coherently before the next slice starts.

### What warrants a second pair of eyes

- The placeholder root handler is intentionally temporary and will be replaced once the embedded frontend exists.
- The app lifecycle is minimal and will need to absorb more moving pieces once background goroutines are added.

### What should be done in the future

- Implement the in-memory state model, reconcile controller, worker runtime, and streaming API on top of this scaffold.

### Code review instructions

- Start with `cmd/pod-demo/main.go`, `internal/app/app.go`, and `internal/server/handler.go`.
- Validate with `go test ./... -count=1`.
- Confirm the commit hash for this step is `0eb5c49a40129a44b263d6b8c520206e64663b42`.

### Technical details

- New files: `go.mod`, `cmd/pod-demo/main.go`, `internal/app/app.go`, `internal/server/handler.go`, `internal/server/handler_test.go`
- Health endpoint: `GET /api/healthz`

## Step 4: Implement The Backend Runtime, Reconciliation Loop, And Streaming API

This step turned the scaffold into a functioning backend model of the system described in the design docs. The server now owns deployment state, pods, workers, reconcile phases, logs, scale changes, manual pod kill, chaos toggling, and a WebSocket stream for frontend subscribers.

The main implementation decision held steady from the design: workers communicate with the controller through typed in-process Go commands and events. The resulting code is still an MVP, but it now expresses the real runtime boundaries instead of keeping everything in one browser component.

### Prompt Context

**User prompt (verbatim):** (see Step 3)

**Assistant interpretation:** Continue the task-by-task implementation loop by replacing the placeholder server with real backend state, controller logic, worker goroutines, HTTP endpoints, and a WebSocket event stream.

**Inferred user intent:** See the architecture translated into working code in small reviewable increments, with tests and operational notes preserved alongside the ticket.

**Commit (code):** ad91f61f68cf01b307cb5e772e4f2d41724b069b — "feat(backend): add reconciliation runtime"

### What I did

- Added backend domain types in `internal/domain/model.go`.
- Added the in-memory source-of-truth store in `internal/state/store.go`.
- Added worker commands, events, manager, and goroutine runtime in `internal/worker/*`.
- Added the event fan-out hub in `internal/events/hub.go`.
- Added the reconcile loop in `internal/controller/controller.go`.
- Added system orchestration and worker-event consumption in `internal/system/service.go`.
- Replaced the placeholder server with endpoints for:
  - `GET /api/healthz`
  - `GET /api/snapshot`
  - `PATCH /api/deployments/web`
  - `POST /api/chaos/toggle`
  - `POST /api/pods/{id}/kill`
  - `GET /ws`
- Updated the app lifecycle to start the background runtime before serving requests.
- Expanded backend tests to cover snapshot and scale-triggered reconcile behavior.
- Ran:

```text
gofmt -w $(rg --files -g "*.go")
go test ./... -count=1
go mod tidy
go test ./... -count=1
git commit -m "feat(backend): add reconciliation runtime"
```

### Why

- The repository needed a real backend authority before a React frontend could be wired meaningfully.
- Implementing the runtime first keeps the frontend task focused on projection and transport, not on business logic.
- The typed worker command/event model is the simplest concrete expression of the design recommendation.

### What worked

- The backend now models the major concepts from the original demo: desired replicas, running/pending/terminating pods, worker assignment, reconcile phases, logs, and chaos toggling.
- The HTTP test surface stayed small and direct.
- The WebSocket dependency resolved successfully once the command ran outside the sandbox with access to the normal Go cache.

### What didn't work

- The first `go test ./... -count=1` failed before `go.sum` existed:

```text
internal/server/handler.go:9:2: missing go.sum entry for module providing package github.com/gorilla/websocket
```

- The first sandboxed `go mod tidy` failed because the Go tool could not use the normal build cache:

```text
go: ... open /home/manuel/.cache/go-build/...: permission denied
```

### What I learned

- The backend MVP becomes much easier to reason about once store mutation, controller decisions, worker execution, and HTTP/WebSocket transport each have their own package.
- The current test coverage is enough to prove the backend loop is alive, but not enough yet to prove every lifecycle edge case.

### What was tricky to build

- The main sharp edge was environment-related rather than algorithmic. Adding a real WebSocket implementation meant introducing `github.com/gorilla/websocket`, which in turn required a `go mod tidy` run that could use the machine’s normal Go cache and module download path. I first hit the expected missing-`go.sum` failure, then a sandbox permission error on `/home/manuel/.cache/go-build`, and then resolved both by running the module-resolution/test command outside the sandbox.

### What warrants a second pair of eyes

- The current `RandomRunningPod` helper picks the first running pod rather than a randomized victim. That is acceptable for an MVP but not a realistic chaos implementation.
- The controller currently publishes simple event payloads and immediate phase transitions; if the frontend needs more animated phase timing, that may need a small refinement later.
- The manual kill and scale-down flows both use the same termination path, which is correct for now but worth reviewing if richer reason codes or audit semantics become important.

### What should be done in the future

- Build the React frontend against the new `/api/*` and `/ws` contracts.
- Add backend tests for scale-down, manual kill replacement, and chaos recovery.

### Code review instructions

- Start with `internal/system/service.go`, `internal/controller/controller.go`, and `internal/state/store.go`.
- Then review `internal/worker/*` to see how goroutine workers receive commands and emit lifecycle events.
- Finish with `internal/server/handler.go` and `internal/server/handler_test.go`.
- Validate with `go test ./... -count=1`.

### Technical details

- New dependency: `github.com/gorilla/websocket v1.5.3`
- Core transport endpoints: `GET /api/snapshot`, `PATCH /api/deployments/web`, `POST /api/pods/{id}/kill`, `POST /api/chaos/toggle`, `GET /ws`
- Code commit for this step: `ad91f61f68cf01b307cb5e772e4f2d41724b069b`
