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
