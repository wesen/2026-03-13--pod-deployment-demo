---
Title: Goja Scenario Runtime For Reconcile Presets
Ticket: GOJA-RECONCILE-001
Status: active
Topics:
    - backend
    - frontend
    - architecture
    - websocket
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: internal/controller/controller.go
      Note: Current hardcoded reconcile loop contrasted with the future goja-driven loop
    - Path: internal/system/service.go
      Note: Current backend runtime ownership to be generalized
    - Path: ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/sources/local/Deployment Demo 2 React Source.tsx
      Note: Imported source snapshot used as the main evidence base
    - Path: ui/src/App.tsx
      Note: Current pod-specific frontend contrasted with the imported generic scenario workbench
ExternalSources:
    - local:Deployment Demo 2 React Source.tsx
Summary: Ticket workspace for redesigning the demo around a generic Go host runtime with goja-executed scenario presets loaded from directories.
LastUpdated: 2026-03-13T14:09:29.69167896-04:00
WhatFor: ""
WhenToUse: ""
---



# Goja Scenario Runtime For Reconcile Presets

## Overview

This ticket analyzes how to move from the current hardcoded pod demo and browser-side scenario sketch toward a generic Go-hosted reconcile runtime backed by goja. The imported source demonstrates preset-driven scenario phases in React, while the current repository demonstrates backend-owned loop and transport behavior in Go. The primary design document explains how to combine those two ideas into a preset-directory + goja-VM architecture for a new intern.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- backend
- frontend
- architecture
- websocket

## Tasks

See [tasks.md](./tasks.md) for the current task list.

## Changelog

See [changelog.md](./changelog.md) for recent changes and decisions.

## Structure

- design/ - Architecture and design documents
- reference/ - Prompt packs, API contracts, context summaries
- playbooks/ - Command sequences and test procedures
- scripts/ - Temporary code and tooling
- various/ - Working notes and research
- archive/ - Deprecated or reference-only artifacts
