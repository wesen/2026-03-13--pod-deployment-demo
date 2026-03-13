---
Title: Cleanup And Modularization Plan For Scenario Runtime And Workbench
Ticket: SCENARIO-CLEANUP-001
Status: active
Topics:
    - backend
    - frontend
    - architecture
    - websocket
DocType: index
Intent: long-term
Owners: []
RelatedFiles: []
ExternalSources: []
Summary: ""
LastUpdated: 2026-03-13T17:31:00-04:00
WhatFor: "Cleanup planning for the scenario runtime, dev workflow, and workbench modularization."
WhenToUse: "Use when simplifying the Go + goja scenario stack, standardizing the local dev loop, or breaking the React workbench into maintainable modules."
---

# Cleanup And Modularization Plan For Scenario Runtime And Workbench

## Overview

This ticket documents how the current scenario runtime actually boots, how to run the Go server and Vite side by side, what is structurally sound, and what should be simplified next. The focus is not a speculative rewrite. The focus is reducing avoidable complexity while preserving the parts that already work well: the preset catalog, the goja runtime host, the scenario session loop, and the newer workbench design.

The main deliverable is the intern-facing design and cleanup guide in `design-doc/01-intern-guide-to-cleanuping-the-scenario-runtime-and-workbench.md`. That document maps the current system, calls out concrete code smells with file references, proposes a smaller target architecture, and lays out a phased implementation plan.

## Key Links

- Primary guide: `design-doc/01-intern-guide-to-cleanuping-the-scenario-runtime-and-workbench.md`
- Bug report: `design-doc/02-bug-report-for-json-parse-failures-and-slider-driven-state-resets.md`
- Go architecture review: `design-doc/03-go-architecture-review-for-scenario-runtime-cleanup.md`
- Diary: `reference/01-investigation-diary.md`
- Tasks: `tasks.md`
- Canonical app bootstrap: `internal/app/app.go`
- Runtime session loop: `internal/scenario/runtime/session.go`
- goja host VM: `internal/scenario/runtime/vm.go`
- Scenario HTTP and WebSocket API: `internal/scenario/server/handler.go`
- Current monolithic workbench: `ui/src/ScenarioApp.tsx`
- Embedded frontend build pipeline: `internal/web/generate_build.go`
- Legacy backend still present: `internal/server/handler.go`, `internal/system/service.go`

## Status

Current status: **active**

Current sub-status:
- Investigation complete
- Intern guide written
- Bug report written
- Go architecture review written
- tmux dev workflow validated outside sandbox
- reMarkable bundle uploaded and verified

## Topics

- backend
- frontend
- architecture
- websocket

## Tasks

See [tasks.md](./tasks.md) for the granular cleanup and modularization plan. The task list separates:
- documentation and investigation work completed in this ticket
- documented bug investigations and review artifacts
- recommended backend cleanup steps
- recommended UI modularization steps
- validation and build-system follow-ups

## Changelog

See [changelog.md](./changelog.md) for the chronological record of investigation, guide authoring, validation, and upload.

## Structure

- design/ - Architecture and design documents
- reference/ - Prompt packs, API contracts, context summaries
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
