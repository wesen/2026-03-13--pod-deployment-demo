---
Title: Move Pod Reconciliation To Go Backend
Ticket: POD-DEPLOYMENT-001
Status: active
Topics:
    - backend
    - frontend
    - websocket
    - architecture
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: ttmp/2026/03/13/POD-DEPLOYMENT-001--move-pod-reconciliation-to-go-backend/sources/local/Original React Pod Deployment Demo.jsx
      Note: Imported local copy stored with the ticket
ExternalSources:
    - local:Original React Pod Deployment Demo.jsx
Summary: Ticket workspace for redesigning the pod deployment demo around a Go reconciliation backend, goroutine workers, and a React WebSocket client.
LastUpdated: 2026-03-13T13:23:34.140045613-04:00
WhatFor: ""
WhenToUse: ""
---




# Move Pod Reconciliation To Go Backend

## Overview

This ticket captures an architecture analysis of the imported pod deployment demo source. The current implementation keeps reconciliation, pod lifecycle, logs, chaos behavior, and rendering inside one React component. The resulting design direction is to move runtime authority into a Go backend, model workers as goroutines, and stream authoritative state into the frontend over WebSocket.

Current status: the concise design doc, the detailed intern guide, and the investigation diary are populated; the source snapshot is imported into `sources/local/`; and the recommended worker protocol is typed in-process Go channels rather than Watermill or HTTP.

## Key Links

- **Related Files**: See frontmatter RelatedFiles field
- **External Sources**: See frontmatter ExternalSources field

## Status

Current status: **active**

## Topics

- backend
- frontend
- websocket
- architecture

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
