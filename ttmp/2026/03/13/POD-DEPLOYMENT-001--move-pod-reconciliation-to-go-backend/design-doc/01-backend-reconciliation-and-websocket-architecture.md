---
Title: Backend Reconciliation And WebSocket Architecture
Ticket: POD-DEPLOYMENT-001
Status: active
Topics:
    - backend
    - frontend
    - websocket
    - architecture
DocType: design-doc
Intent: long-term
Owners: []
RelatedFiles:
    - Path: ../../../../../../../../../../../tmp/pod-deployment.jsx
      Note: Original source analyzed for current-state behavior
    - Path: ttmp/2026/03/13/POD-DEPLOYMENT-001--move-pod-reconciliation-to-go-backend/sources/local/Original React Pod Deployment Demo.jsx
      Note: Imported snapshot attached to the ticket for review
ExternalSources: []
Summary: Move the reconciliation loop and pod lifecycle into a Go backend, stream state to React over WebSocket, and keep goroutine workers on typed in-process channels.
LastUpdated: 2026-03-13T13:23:34.04970829-04:00
WhatFor: ""
WhenToUse: ""
---


# Backend Reconciliation And WebSocket Architecture

## Executive Summary

The current demo keeps the control plane, worker behavior, pod lifecycle, and UI rendering inside one React component. Desired replicas, actual pods, reconciliation phase, controller logs, auto-resync, chaos injection, and manual pod kill all mutate local component state directly. That makes the visualization effective, but it also means there is no backend authority, no durable state boundary, and no real transport contract between the control plane and workers.

The recommended redesign is to move the reconciliation loop and pod lifecycle into a Go backend, model workers as goroutines, and use a WebSocket stream to push authoritative state into the React frontend. The frontend becomes a visualization and control client instead of the execution environment. For controller-to-worker communication inside the Go process, use typed Go channels and explicit command/event structs, not Watermill and not HTTP. Watermill only becomes attractive if the workers are expected to become separate processes or broker-backed consumers in the near future.

## Problem Statement

The user request is to turn the demo into a backend-driven system with:

1. Pods and the reconciliation algorithm moved into a Go backend.
2. Workers represented as goroutines.
3. State updates streamed to the React frontend over WebSocket.
4. A recommendation for the worker-to-main protocol.

The current implementation does not satisfy those requirements because the controller and workers are simulated inside a single browser runtime. All state is ephemeral and tied to a mounted React component.

## Current-State Analysis

### Observed runtime model

The single `KubernetesDemo` component owns all operational state:

- `desiredReplicas`, `pods`, `logs`, `reconciling`, `loopPhase`, `autoMode`, and `chaosMode` are all React state variables in `/tmp/pod-deployment.jsx:77-89`.
- The component seeds three running pods on mount and logs controller startup in `/tmp/pod-deployment.jsx:105-110`.
- The reconciliation loop fetches desired state, lists current pods, computes drift, and creates or deletes pods by calling `setPods` directly in `/tmp/pod-deployment.jsx:112-170`.
- Automatic resync is a browser interval in `/tmp/pod-deployment.jsx:172-179`.
- Chaos mode and manual kill both delete pods from local state in `/tmp/pod-deployment.jsx:181-199`.
- The same component renders the control-plane panel, worker-node pod grid, convergence bar, and logs in `/tmp/pod-deployment.jsx:236-423`.

### What the demo is modeling well

The current file already captures the conceptual controller flow clearly:

1. Read desired state (`spec.replicas`) from the deployment view.
2. Read actual state from currently running pods.
3. Detect drift.
4. Create or delete pods until desired and actual converge.
5. Sleep until the next resync or watch event.

That model is explicitly mirrored in both the loop implementation and the pseudocode panel shown in the UI at `/tmp/pod-deployment.jsx:117-170` and `/tmp/pod-deployment.jsx:274-294`.

### Architectural gaps relative to the requested target

The current design has four major gaps:

1. There is no backend authority. Browser memory is the source of truth.
2. There is no worker boundary. "Worker nodes" are only a rendered grouping of pod icons, not actual executors.
3. There is no transport contract. The React component directly mutates state instead of consuming events or snapshots.
4. There is no concurrency model beyond browser timers. The important coordination problems of backend reconciliation are not represented.

## Gap Analysis

### Why the current component cannot simply be wrapped

Porting the existing code line-for-line into a Go server would preserve the wrong abstraction boundary. The current code mixes:

- domain state,
- reconciliation logic,
- lifecycle timers,
- operator controls,
- presentation state,
- and view rendering.

That is acceptable for a teaching demo, but it is the wrong shape for a backend-backed system. The backend needs explicit domain models and message contracts. The frontend needs a read model that can render without owning the control logic.

### Desired architecture boundary

The backend should own:

- deployment desired state,
- actual pod state,
- worker inventory,
- reconciliation phase,
- lifecycle transitions,
- event emission,
- and operator commands.

The frontend should own:

- rendering,
- local control widgets,
- optimistic affordances if desired,
- connection state,
- and derived presentation-only formatting.

## Proposed Solution

### High-level architecture

Use a single Go process with four backend subsystems:

1. `ControlPlane`: owns desired state, pod inventory, reconcile loop, and logs.
2. `WorkerManager`: owns worker goroutines and routes pod lifecycle commands to them.
3. `EventHub`: fans backend events out to subscribed WebSocket clients.
4. `HTTP API`: handles mutating user intents such as scaling or manual pod kill.

Use the React app as a thin control/visualization client:

1. Initial load requests a snapshot over HTTP or receives one immediately after WebSocket connect.
2. Subsequent state changes arrive over WebSocket as typed events.
3. UI controls submit commands to the backend.
4. The frontend no longer manufactures pods locally.

### Domain model

Suggested Go domain types:

```go
type DeploymentSpec struct {
	Name     string
	Replicas int
}

type PodPhase string

const (
	PodPending     PodPhase = "pending"
	PodRunning     PodPhase = "running"
	PodTerminating PodPhase = "terminating"
	PodDeleted     PodPhase = "deleted"
)

type Pod struct {
	ID       string
	Name     string
	Phase    PodPhase
	WorkerID string
}

type Worker struct {
	ID     string
	Pods   map[string]*Pod
	Status string
}
```

### Backend control flow

The controller loop should keep the same conceptual stages the UI already visualizes:

1. Fetch desired deployment state.
2. List actual running and transitional pods.
3. Compare desired replicas with actual running pods.
4. Issue create or terminate commands.
5. Publish phase changes and state deltas to the WebSocket hub.

Suggested reconcile pseudocode:

```go
func (c *Controller) Reconcile(ctx context.Context, reason string) {
	c.setPhase("fetch", reason)
	desired := c.state.Deployment().Replicas

	c.setPhase("compare", reason)
	actual := c.state.RunningPods()
	diff := desired - len(actual)

	c.logReconcile(desired, len(actual), diff)

	c.setPhase("act", reason)
	switch {
	case diff > 0:
		for i := 0; i < diff; i++ {
			pod := c.state.CreatePendingPod()
			workerID := c.scheduler.Assign(pod)
			c.workerCommands <- SpawnPod{WorkerID: workerID, PodID: pod.ID}
			c.events.Publish(PodCreated{Pod: pod})
		}
	case diff < 0:
		for _, pod := range c.terminationPlan(actual, -diff) {
			c.state.MarkTerminating(pod.ID)
			c.workerCommands <- TerminatePod{WorkerID: pod.WorkerID, PodID: pod.ID}
			c.events.Publish(PodUpdated{PodID: pod.ID, Phase: "terminating"})
		}
	}

	c.setPhase("sleep", reason)
}
```

### Worker model

Represent each worker node as a long-lived goroutine with:

- an input command channel,
- an output event channel,
- local pod bookkeeping,
- and cancellation via context.

Each worker handles commands such as:

- `SpawnPod`
- `TerminatePod`
- `InjectFailure`
- `SnapshotRequest`

Each worker emits events such as:

- `PodScheduled`
- `PodRunning`
- `PodTerminated`
- `WorkerHeartbeat`
- `WorkerFailure`

### Frontend transport

Use WebSocket from backend to React for streaming state. The current UI already has a natural event-oriented surface:

- logs,
- loop phase,
- desired replicas,
- pod list,
- convergence counts,
- and chaos/manual-kill actions.

Suggested WebSocket envelope:

```json
{
  "type": "pod.updated",
  "ts": "2026-03-13T13:30:00Z",
  "payload": {
    "id": "pod-7",
    "name": "web-k2m8qd",
    "phase": "running",
    "workerId": "worker-b"
  }
}
```

Recommended event types:

- `snapshot`
- `deployment.updated`
- `reconcile.phase`
- `pod.created`
- `pod.updated`
- `pod.deleted`
- `worker.updated`
- `log.append`
- `chaos.injected`

For browser-to-backend mutations, prefer HTTP for simplicity:

- `PATCH /api/deployments/web` to change desired replicas
- `POST /api/pods/{id}/kill` for manual kill
- `POST /api/chaos/toggle` or `POST /api/chaos/inject`

This keeps WebSocket focused on fan-out and avoids mixing request/response semantics into the stream unless there is a strong reason to support duplex commands.

## Design Decisions

### Decision 1: Backend owns truth

Rationale: the current React component is both model and renderer. Moving truth into Go is necessary to make the frontend observational instead of authoritative.

### Decision 2: Workers are goroutines, not browser simulations

Rationale: the user explicitly asked for workers as goroutines. That also matches the desired runtime boundary better than keeping worker semantics in the UI.

### Decision 3: WebSocket for state distribution to React

Rationale: the UI is event-heavy and low-latency. A WebSocket stream maps cleanly onto logs, phase changes, pod lifecycle updates, and chaos events.

### Decision 4: Typed channels between controller and workers

Rationale: controller and workers live in the same process. In-process channels preserve strong typing, low overhead, and direct cancellation semantics.

### Decision 5: HTTP for browser-originated commands

Rationale: scale requests and manual kill are command-like operations with simple acknowledgement semantics. HTTP is easier to reason about and test than a custom request/response layer over WebSocket.

## Alternatives Considered

### Alternative 1: Keep logic in React and add a thin persistence layer

Rejected because it does not satisfy the requested backend move and keeps the browser as the execution authority.

### Alternative 2: Use WebSocket for both commands and events

Viable, but not preferred initially. It increases protocol surface area and requires correlation IDs, error frames, and reconnect semantics for mutating operations. Use it only if the product specifically needs full-duplex command handling.

### Alternative 3: Use Watermill for worker communication

Not recommended for the first implementation. Watermill is useful when there is a real broker boundary, message durability need, or multiple process/service consumers. None of that exists in the observed source file.

### Alternative 4: Use HTTP between goroutines

Rejected. HTTP inside one process adds serialization, routing, error mapping, and lifecycle overhead without creating a meaningful architectural benefit.

## Implementation Plan

### Phase 1: Establish backend domain model

1. Create Go types for deployment, pods, workers, reconcile phase, and log entries.
2. Move pod lifecycle state transitions out of React and into backend state storage.
3. Preserve the current phases (`idle`, `fetch`, `compare`, `act`, `sleep`) to keep the UI mental model intact.

### Phase 2: Implement controller and worker runtime

1. Add a controller goroutine with ticker-driven and event-driven reconcile triggers.
2. Add worker goroutines with typed input/output channels.
3. Add a scheduler that assigns new pods to workers.
4. Translate worker events into backend state mutations.

### Phase 3: Add transport layer

1. Add HTTP endpoints for scale and kill commands.
2. Add a WebSocket hub for state snapshots and incremental events.
3. Define stable JSON contracts for snapshot and delta messages.

### Phase 4: Refactor React frontend

1. Replace local pod state with server snapshot state.
2. Replace local log generation with streamed backend logs.
3. Replace local intervals and chaos logic with backend-issued events.
4. Keep the existing visual layout where possible, because it already communicates the control-plane story well.

### Phase 5: Hardening

1. Add deterministic tests for reconcile diff computation.
2. Add worker lifecycle and failure-injection tests.
3. Add WebSocket contract tests.
4. Add frontend integration tests against a mock or test backend.

## Test Strategy

### Backend

1. Unit test reconcile decisions for scale up, scale down, convergence, and chaos-induced drift.
2. Unit test worker command handling and emitted event ordering.
3. Add race-enabled tests around state mutation and event fan-out.
4. Add integration tests for HTTP mutations plus resulting WebSocket event sequences.

### Frontend

1. Test that `snapshot` initializes the UI.
2. Test that `pod.updated`, `reconcile.phase`, and `log.append` mutate the rendered view correctly.
3. Test reconnect and snapshot replay behavior.

## Worker-To-Main Protocol Recommendation

Use in-process typed Go channels, with explicit command and event structs, for worker-to-controller communication.

Recommended shape:

```go
type WorkerCommand interface{ isWorkerCommand() }
type WorkerEvent interface{ isWorkerEvent() }

type SpawnPod struct { WorkerID, PodID string }
type TerminatePod struct { WorkerID, PodID string }

type PodRunning struct { WorkerID, PodID string }
type PodTerminated struct { WorkerID, PodID string }
type WorkerHeartbeat struct { WorkerID string; At time.Time }
```

Reasons:

1. The workers are goroutines in the same Go process, so channels are the natural concurrency primitive.
2. Channels preserve backpressure and cancellation more directly than a bus abstraction.
3. Typed structs are easier to refactor and test than ad hoc JSON or HTTP payloads.
4. This matches the current problem size. The imported React demo models one controller and a small worker fleet, not a distributed brokered system.

Watermill is a reasonable later upgrade if one of these becomes true:

1. workers become separate processes,
2. events need broker durability or replay,
3. multiple subsystems need subscription decoupling,
4. or the system starts integrating with other services.

HTTP should not be used between the controller and goroutine workers. It introduces artificial network boundaries inside one process and makes shutdown, backpressure, and testing worse.

## Open Questions

1. Does the backend need durable persistence, or is in-memory state acceptable for the first version?
2. Should the scheduler simply round-robin workers, or should it simulate worker capacity?
3. Does the frontend need full event history, or only latest-state plus rolling logs?
4. Should reconnect always resend a full snapshot before live deltas resume?
5. Does chaos mode belong in production code, or only behind a demo/test feature flag?

## References

1. `/tmp/pod-deployment.jsx:77-205` for the current state ownership, reconcile loop, and chaos/manual kill behavior.
2. `/tmp/pod-deployment.jsx:236-423` for the control-plane and worker-node UI surfaces that the backend contract must continue to support.
3. `/home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/POD-DEPLOYMENT-001--move-pod-reconciliation-to-go-backend/sources/local/Original React Pod Deployment Demo.jsx` for the imported source snapshot attached to the ticket.
