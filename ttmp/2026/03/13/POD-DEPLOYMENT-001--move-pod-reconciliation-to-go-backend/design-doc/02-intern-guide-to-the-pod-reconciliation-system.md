---
Title: Intern Guide To The Pod Reconciliation System
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
    - Path: ttmp/2026/03/13/POD-DEPLOYMENT-001--move-pod-reconciliation-to-go-backend/design-doc/01-backend-reconciliation-and-websocket-architecture.md
      Note: Concise companion design doc that the intern guide expands
    - Path: ttmp/2026/03/13/POD-DEPLOYMENT-001--move-pod-reconciliation-to-go-backend/sources/local/Original React Pod Deployment Demo.jsx
      Note: Imported source snapshot used as the evidence base for the intern guide
ExternalSources: []
Summary: Detailed intern-oriented guide to the current React demo, the target Go backend plus WebSocket architecture, the runtime components, the APIs, and the implementation plan.
LastUpdated: 2026-03-13T13:34:09.897630494-04:00
WhatFor: ""
WhenToUse: ""
---


# Intern Guide To The Pod Reconciliation System

## Executive Summary

This document is a slower, more detailed companion to the first design doc. It is written for an intern or any engineer who is new to reconciliation systems, evented frontends, and Go concurrency. The goal is not just to say what should be built, but to explain how the current demo works, why the proposed backend split exists, what every major subsystem is responsible for, and how to implement the migration in a way that preserves the mental model of the original visualization.

Today, the entire system lives in one React component: it stores desired replica count, pod state, controller phase, controller logs, chaos mode, and UI rendering in browser memory. The target system moves all runtime authority into a Go backend. The backend becomes the source of truth for deployments, pods, workers, reconcile phases, and lifecycle events. The React frontend becomes a client that renders server state and sends user intent. Workers are represented as goroutines, and the frontend receives authoritative updates from the backend over WebSocket.

The most important architectural recommendation in this guide is simple: use typed in-process Go channels for communication between the controller and worker goroutines. Do not use HTTP between goroutines, and do not introduce Watermill unless the design is truly heading toward multi-process or broker-backed execution. For the browser boundary, use WebSocket for streamed state and simple HTTP endpoints for user-triggered mutations such as scaling and manual pod kill.

## Problem Statement

The user request is to analyze the existing pod deployment demo and design a new backend-driven version with:

1. pods and reconciliation moved into a Go backend,
2. workers modeled as goroutines,
3. a WebSocket connection to the React frontend,
4. and a clear recommendation about the worker-to-main protocol.

That request sounds straightforward, but it actually hides two distinct jobs:

1. Understand the current demo as it really exists.
2. Redraw the architecture so responsibilities live in the right runtime.

If we skip the first job, the second job becomes speculation. This guide therefore starts by reading the current code carefully and explaining the meaning of each part before recommending the migration plan.

## Scope

This guide covers:

- the current demo architecture,
- the conceptual model of a reconciliation system,
- the target backend and frontend boundaries,
- backend data structures and APIs,
- controller and worker pseudocode,
- frontend integration shape,
- file-by-file implementation guidance,
- testing strategy,
- and common pitfalls.

This guide does not assume an existing Go codebase in the repository. The repository is effectively empty apart from the local `docmgr` workspace, so proposed backend and frontend file references below are suggested new files rather than existing ones.

## Current-State Analysis

### What file currently defines the system

The current system is defined by a single imported React source file:

- Original source: `/tmp/pod-deployment.jsx`
- Imported ticket snapshot: `sources/local/Original React Pod Deployment Demo.jsx`

The most important evidence spans are:

- `/tmp/pod-deployment.jsx:77-89` for top-level state ownership
- `/tmp/pod-deployment.jsx:105-110` for initial pod seeding
- `/tmp/pod-deployment.jsx:112-170` for the reconciliation loop
- `/tmp/pod-deployment.jsx:172-193` for automatic resync and chaos mode
- `/tmp/pod-deployment.jsx:195-199` for manual pod kill
- `/tmp/pod-deployment.jsx:236-423` for the UI panels and rendered view of the system

### How to think about the current demo

Even though the file is just a UI component, it is simulating three different layers at once:

1. a control plane,
2. a worker fleet,
3. and the user interface.

That is the central fact an intern needs to understand. The current file is not "just a frontend." It is a self-contained demo runtime disguised as a frontend component.

### Current runtime state

The `KubernetesDemo` component owns the entire model of the system in React state at `/tmp/pod-deployment.jsx:77-89`.

Those state values mean:

- `desiredReplicas`: what the deployment wants
- `pods`: the current pod inventory, including phase
- `logs`: controller log lines shown in the UI
- `reconciling`: whether a reconcile run is active
- `loopPhase`: which stage of the reconcile loop is visible
- `autoMode`: whether periodic reconcile is enabled
- `chaosMode`: whether random pod deletion is enabled

This means there is no backend source of truth. If the page refreshes, the world disappears. If two browser tabs open, they do not share state. If a user kills a pod, the kill is not a backend command. It is just a local array mutation.

### Current control-plane behavior

The reconcile loop in `/tmp/pod-deployment.jsx:112-170` models the classic controller pattern:

1. read desired state,
2. read actual state,
3. compare,
4. act,
5. wait for the next event or resync.

This is good news. The demo already expresses the right control theory. The redesign does not need a new mental model. It needs a new runtime home for the same mental model.

### Current worker behavior

The "worker nodes" in the current UI are visual, not computational. The right-hand panel at `/tmp/pod-deployment.jsx:349-407` renders pods, but those pods are not owned by real worker processes or goroutines. They are just objects in the same `pods` array used by the controller.

In other words:

- there is no scheduler,
- there is no worker command channel,
- there is no worker heartbeat,
- and there is no worker-local pod state.

### Current event behavior

The current file uses timers to imitate runtime events:

- `setInterval` triggers automatic reconcile at `/tmp/pod-deployment.jsx:172-179`
- another `setInterval` drives chaos mode at `/tmp/pod-deployment.jsx:181-193`
- `setTimeout` simulates pod startup and termination at `/tmp/pod-deployment.jsx:147-149` and `/tmp/pod-deployment.jsx:157-159`

This is valuable because it tells us what kinds of lifecycle transitions the real backend must emit.

## System Concepts For An Intern

### Deployment

A deployment is the high-level desired state. In this demo, the deployment really only has one important field: replica count. When the UI changes `desiredReplicas`, it is effectively editing `Deployment.spec.replicas`.

### Pod

A pod is the unit the controller creates or deletes to make the world match the deployment. In the current demo, pods have:

- an `id`,
- a generated `name`,
- and a `status` such as `running`, `pending`, or `terminating`.

### Desired state vs actual state

This is the core idea behind reconciliation:

- desired state is what the system wants,
- actual state is what the system currently has.

When these differ, the controller creates work to reduce the difference.

### Reconciliation loop

The reconcile loop is not a UI feature. It is the core backend algorithm. The UI only visualizes it.

### Worker

In the target design, a worker is a goroutine-backed actor that can receive commands such as "start this pod" or "terminate this pod" and report events such as "pod is now running."

### Event stream

An event stream is how the backend tells the frontend that something changed. Examples:

- the reconcile phase changed,
- a pod was created,
- a pod became running,
- a pod was deleted,
- chaos killed a pod,
- a new log line was appended.

## Architecture Overview

### Current architecture diagram

```text
+--------------------------------------------------------------+
| Browser / React Component                                    |
|                                                              |
|  +----------------------+   +-----------------------------+  |
|  | Control Plane Panel  |   | Worker Nodes Panel          |  |
|  | - desiredReplicas    |   | - pods[] rendered as icons  |  |
|  | - loopPhase          |   | - click to kill pod         |  |
|  | - logs               |   +-----------------------------+  |
|  | - reconcile()        |                                     |
|  | - autoMode timer     |   +-----------------------------+  |
|  | - chaosMode timer    |   | Logs Panel                  |  |
|  +----------------------+   | - logs[]                    |  |
|                             +-----------------------------+  |
|                                                              |
| All state and behavior are local to the same component.      |
+--------------------------------------------------------------+
```

### Target architecture diagram

```text
+--------------------+         WebSocket          +----------------------+
| React Frontend     | <------------------------> | Go Event Hub         |
|                    |                            | - client registry    |
| - render snapshot  |            HTTP            | - broadcast events   |
| - render deltas    | -------------------------> | - snapshot on join   |
| - user controls    |                            +----------+-----------+
+---------+----------+                                       |
          |                                                  |
          |                                                  v
          |                                     +-------------------------+
          |                                     | Controller / Store      |
          |                                     | - deployment state      |
          |                                     | - pod state             |
          |                                     | - reconcile loop        |
          |                                     | - scheduler             |
          |                                     +-----------+-------------+
          |                                                 |
          |                                         typed channels
          |                                                 |
          |                                                 v
          |                                     +-------------------------+
          |                                     | Worker Goroutines       |
          |                                     | - worker A              |
          |                                     | - worker B              |
          |                                     | - pod lifecycle         |
          |                                     +-------------------------+
```

### Responsibility split

Backend responsibilities:

- store desired and actual state,
- run reconciliation,
- own worker lifecycle,
- publish events,
- accept mutating commands,
- and generate authoritative logs.

Frontend responsibilities:

- display state,
- visualize reconcile phases,
- send user commands,
- and manage connection/reconnect behavior.

## Proposed Solution

### High-level design

Build a single Go service that exposes:

1. an HTTP API for simple mutations,
2. a WebSocket endpoint for snapshots and live events,
3. a controller that owns reconcile logic,
4. a worker manager that runs workers as goroutines.

Then refactor the React app so it:

1. subscribes to the WebSocket stream,
2. renders backend state,
3. issues commands instead of mutating local pod state,
4. preserves the existing visual storytelling.

### Why this design is the right size

This design is intentionally modest. It solves the actual problem shown by the imported source without inventing distributed-systems complexity that the current demo does not need.

That matters for intern onboarding. Interns usually struggle when a system contains abstractions introduced for hypothetical future requirements instead of real current ones. The more direct design is easier to learn, easier to test, and easier to evolve.

## Backend Subsystems

### 1. State store

The store is the in-memory source of truth. It owns the deployment, pods, workers, reconcile phase, and logs. It does not need a database for the first version unless persistence is explicitly required.

Suggested Go file references:

- `cmd/pod-demo/main.go`
- `internal/domain/deployment.go`
- `internal/domain/pod.go`
- `internal/domain/worker.go`
- `internal/state/store.go`

Suggested state shape:

```go
type StateStore struct {
	mu         sync.RWMutex
	deployment DeploymentSpec
	pods       map[string]*Pod
	workers    map[string]*Worker
	phase      ReconcilePhase
	logs       []LogEntry
}
```

### 2. Controller

The controller reads desired state and actual state, computes drift, and issues commands. It should be the only subsystem that decides whether to create or delete pods to reach convergence.

Suggested file references:

- `internal/controller/controller.go`
- `internal/controller/reconcile.go`
- `internal/controller/scheduler.go`

Responsibilities:

- run reconcile on a ticker,
- run reconcile on meaningful events,
- update phase transitions,
- log decisions,
- and emit events after state changes.

### 3. Scheduler

The scheduler decides which worker should receive a newly created pod. For the first version, a simple round-robin scheduler is enough.

Do not hide the scheduler inside a complex abstraction on day one. Interns should be able to read one small file and understand the policy.

### 4. Worker manager

The worker manager owns worker goroutines and their channels.

Suggested file references:

- `internal/worker/manager.go`
- `internal/worker/worker.go`
- `internal/worker/messages.go`

Responsibilities:

- start workers,
- route commands to workers,
- consume worker events,
- and shut workers down with context cancellation.

### 5. Event hub

The event hub turns backend changes into frontend-visible messages.

Suggested file references:

- `internal/events/hub.go`
- `internal/events/types.go`
- `internal/events/ws_handler.go`

Responsibilities:

- accept subscriptions,
- publish snapshots and deltas,
- broadcast log and phase changes,
- and handle client disconnects.

### 6. HTTP API

The HTTP API is the cleanest place for browser-originated mutations.

Suggested file references:

- `internal/http/routes.go`
- `internal/http/deployment_handler.go`
- `internal/http/pod_handler.go`
- `internal/http/chaos_handler.go`

## API References

### HTTP endpoints

#### `GET /api/snapshot`

Returns the current full state for initial page load or reconnect fallback.

Example response:

```json
{
  "deployment": { "name": "web", "replicas": 3 },
  "phase": "idle",
  "pods": [
    { "id": "pod-1", "name": "web-ab12cd", "phase": "running", "workerId": "worker-a" }
  ],
  "workers": [
    { "id": "worker-a", "status": "ready", "podCount": 1 }
  ],
  "logs": [
    { "ts": "2026-03-13T17:40:00Z", "type": "watch", "text": "Controller started" }
  ]
}
```

#### `PATCH /api/deployments/web`

Changes desired replicas.

Request:

```json
{
  "replicas": 5
}
```

Response:

```json
{
  "ok": true,
  "deployment": { "name": "web", "replicas": 5 }
}
```

#### `POST /api/pods/{id}/kill`

Simulates an operator killing a running pod.

#### `POST /api/chaos/toggle`

Enables or disables chaos mode.

Request:

```json
{
  "enabled": true
}
```

### WebSocket events

All WebSocket messages should use a stable envelope:

```json
{
  "type": "pod.updated",
  "ts": "2026-03-13T17:41:00Z",
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

## Worker Protocol Recommendation

### Short answer

Use typed in-process Go channels between the controller and worker goroutines.

### Why not HTTP

HTTP is a network boundary protocol. Goroutines in the same process are not network peers. If you use HTTP between them, you add:

- serialization overhead,
- routing overhead,
- fake transport failures,
- more complicated shutdown,
- and a misleading architecture.

That complexity teaches the wrong lesson to an intern.

### Why not Watermill yet

Watermill is a good tool when:

- you need broker-backed pub/sub,
- consumers may live in different processes,
- or durability/replay matters.

None of those requirements are visible in the imported React demo. Introducing Watermill now would likely obscure the system rather than clarify it.

### Recommended channel types

```go
type WorkerCommand interface{ isWorkerCommand() }
type WorkerEvent interface{ isWorkerEvent() }

type SpawnPod struct {
	WorkerID string
	PodID    string
}

type TerminatePod struct {
	WorkerID string
	PodID    string
}

type InjectFailure struct {
	WorkerID string
	Reason   string
}

type PodRunning struct {
	WorkerID string
	PodID    string
}

type PodTerminated struct {
	WorkerID string
	PodID    string
}

type WorkerHeartbeat struct {
	WorkerID string
	At       time.Time
}
```

### Communication diagram

```text
Controller
   |
   | workerCommands <- SpawnPod / TerminatePod / InjectFailure
   v
+---------+      +---------+      +---------+
| WorkerA |      | WorkerB |      | WorkerC |
+----+----+      +----+----+      +----+----+
     |                |                |
     +----------------+----------------+
                      |
                      | workerEvents -> PodRunning / PodTerminated / Heartbeat
                      v
                 Controller event handler
```

## Reconcile Algorithm Deep Walkthrough

### Desired behavior

At any moment, the system should try to make:

`count(running pods) == deployment.spec.replicas`

Pending and terminating pods still matter for visibility, but the main convergence measure is the number of running pods.

### Pseudocode

```go
func (c *Controller) Reconcile(ctx context.Context, trigger string) error {
	c.setPhase(FetchPhase)
	desired := c.store.Deployment().Replicas

	c.setPhase(ComparePhase)
	running := c.store.RunningPods()
	diff := desired - len(running)
	c.logf("reconcile trigger=%s desired=%d running=%d diff=%d", trigger, desired, len(running), diff)

	c.setPhase(ActPhase)
	switch {
	case diff > 0:
		for i := 0; i < diff; i++ {
			pod := c.store.CreatePendingPod("web")
			worker := c.scheduler.AssignPod(pod)
			c.workerManager.Send(SpawnPod{WorkerID: worker.ID, PodID: pod.ID})
			c.events.Publish(PodCreated{Pod: pod})
		}
	case diff < 0:
		victims := c.selectVictims(running, -diff)
		for _, pod := range victims {
			c.store.MarkTerminating(pod.ID)
			c.workerManager.Send(TerminatePod{WorkerID: pod.WorkerID, PodID: pod.ID})
			c.events.Publish(PodUpdated{PodID: pod.ID, Phase: "terminating"})
		}
	default:
		c.logf("state converged")
	}

	c.setPhase(SleepPhase)
	return nil
}
```

### Scale-up flow

```text
1. User changes replicas from 3 -> 5
2. HTTP handler updates deployment spec
3. Controller reconcile sees diff = +2
4. Store creates 2 pending pods
5. Scheduler assigns workers
6. Controller sends SpawnPod commands
7. Workers emit PodRunning events after startup delay/work
8. Store updates phases to running
9. Event hub sends pod.updated + log.append + reconcile.phase events
10. React UI redraws counts and pod icons
```

### Scale-down flow

```text
1. User changes replicas from 5 -> 2
2. Controller reconcile sees diff = -3
3. Controller selects 3 victim pods
4. Store marks them terminating
5. Controller sends TerminatePod commands
6. Workers emit PodTerminated events
7. Store removes deleted pods
8. Event hub broadcasts updates
9. UI convergence bar moves toward 2/2
```

### Manual kill flow

```text
1. User clicks a running pod in the UI
2. Frontend sends POST /api/pods/{id}/kill
3. Backend marks the pod gone or terminating
4. A reconcile trigger fires
5. Controller sees desired > running
6. Controller creates replacement work
```

### Chaos flow

```text
1. Chaos mode enabled
2. Backend timer or action randomly selects a running pod
3. Pod disappears or transitions through terminating
4. Event hub broadcasts chaos.injected + pod.updated/pod.deleted
5. Reconcile notices drift and creates replacement
```

## Frontend Implementation Guidance

### What the frontend should stop doing

The frontend should no longer:

- create pods locally,
- delete pods locally,
- own the main log buffer,
- run the authoritative reconcile loop,
- or simulate worker behavior with local timers.

Those behaviors belong in Go.

### What the frontend should continue doing

The frontend should keep the current visual organization because it is pedagogically strong:

- left panel for control plane,
- right panel for worker nodes,
- bottom panel for logs.

Suggested frontend file references:

- `web/src/App.tsx`
- `web/src/api/http.ts`
- `web/src/api/ws.ts`
- `web/src/state/store.ts`
- `web/src/components/ControlPlanePanel.tsx`
- `web/src/components/WorkerNodesPanel.tsx`
- `web/src/components/LogsPanel.tsx`
- `web/src/types/protocol.ts`

### Frontend state model

The frontend state should be a projection of backend events:

```ts
type AppState = {
  deployment: { name: string; replicas: number };
  phase: "idle" | "fetch" | "compare" | "act" | "sleep";
  pods: PodView[];
  workers: WorkerView[];
  logs: LogLine[];
  connected: boolean;
};
```

### WebSocket reducer shape

```ts
function applyEvent(state: AppState, event: ServerEvent): AppState {
  switch (event.type) {
    case "snapshot":
      return event.payload;
    case "deployment.updated":
      return { ...state, deployment: event.payload };
    case "reconcile.phase":
      return { ...state, phase: event.payload.phase };
    case "pod.updated":
      return updatePod(state, event.payload);
    case "pod.deleted":
      return removePod(state, event.payload.id);
    case "log.append":
      return appendLog(state, event.payload);
    default:
      return state;
  }
}
```

## File-By-File Implementation Plan

### Phase 1: Bootstrap the Go service

Create:

- `cmd/pod-demo/main.go`
- `internal/app/app.go`
- `internal/state/store.go`
- `internal/domain/*.go`

Goal:

- start a server,
- initialize deployment state,
- create a few workers,
- expose a health endpoint.

### Phase 2: Implement controller and worker runtime

Create:

- `internal/controller/controller.go`
- `internal/controller/reconcile.go`
- `internal/controller/scheduler.go`
- `internal/worker/manager.go`
- `internal/worker/worker.go`
- `internal/worker/messages.go`

Goal:

- make the backend capable of scale-up and scale-down without any frontend.

### Phase 3: Add HTTP and WebSocket transport

Create:

- `internal/http/routes.go`
- `internal/http/deployment_handler.go`
- `internal/http/pod_handler.go`
- `internal/events/hub.go`
- `internal/events/ws_handler.go`

Goal:

- browser can connect,
- browser can change replicas,
- browser can kill pods,
- browser receives live updates.

### Phase 4: Port the React UI

Create or refactor:

- `web/src/App.tsx`
- `web/src/components/*`
- `web/src/api/*`
- `web/src/state/*`

Goal:

- the UI looks and behaves like the original demo,
- but all authoritative state comes from the backend.

### Phase 5: Hardening and teaching artifacts

Add:

- backend tests,
- frontend integration tests,
- sample screenshots or short playbooks,
- and brief comments in critical runtime files.

Goal:

- future interns can read the code without reconstructing the architecture from scratch.

## Testing Strategy

### Backend tests

- unit tests for diff calculation,
- unit tests for victim selection on scale-down,
- unit tests for worker event handling,
- race-enabled tests for store/event concurrency,
- integration tests for HTTP mutations followed by WebSocket events.

### Frontend tests

- reducer tests for each event type,
- connection/reconnect tests,
- rendering tests for convergence bar and pod phases,
- integration tests that mount the UI with a mocked event stream.

### Manual smoke test

```text
1. Start backend
2. Open UI
3. Verify snapshot shows 3 running pods
4. Scale to 5
5. Watch pending -> running transitions
6. Kill one running pod
7. Verify controller restores desired count
8. Enable chaos
9. Verify repeated drift detection and recovery
```

## Risks And Pitfalls

### Pitfall 1: Mixing backend truth with frontend truth

If the frontend tries to keep creating or deleting pods locally, it will drift from the backend and confuse users.

### Pitfall 2: Over-designing worker communication

Interns often assume "events" means "message bus." In this case, in-process channels are the correct event transport.

### Pitfall 3: Broadcasting only deltas with no snapshot path

Reconnect becomes brittle if a client cannot ask for or receive a full snapshot.

### Pitfall 4: Letting every subsystem mutate shared state

State mutation should be controlled. The store and controller should have clear authority boundaries.

## Alternatives Considered

### Keep everything in React

Rejected because it does not satisfy the requested backend design and keeps the browser as the execution engine.

### Use SSE instead of WebSocket

Possible if the frontend only needs server-to-client updates and HTTP handles commands, but WebSocket is a better fit if you want a richer interactive control surface and future duplex extensions.

### Use Watermill immediately

Rejected for now because it solves a larger problem than the one evidenced by the imported source.

## Open Questions

1. Should worker capacity be simulated, or is every worker assumed to have infinite room?
2. Should pod startup and termination be deterministic for tests?
3. Is in-memory state sufficient, or should the backend persist deployment and pod state?
4. Does the frontend need historical event replay, or only current state plus recent logs?

## References

### Existing file references

1. `/tmp/pod-deployment.jsx:77-89` for current state ownership.
2. `/tmp/pod-deployment.jsx:112-170` for current reconcile behavior.
3. `/tmp/pod-deployment.jsx:172-193` for automatic reconcile and chaos timers.
4. `/tmp/pod-deployment.jsx:236-423` for the current UI layout the backend contract should continue supporting.
5. `sources/local/Original React Pod Deployment Demo.jsx` for the ticket-local imported source snapshot.
6. `design-doc/01-backend-reconciliation-and-websocket-architecture.md` for the shorter companion design doc.

### Proposed new implementation files

1. `cmd/pod-demo/main.go`
2. `internal/state/store.go`
3. `internal/controller/controller.go`
4. `internal/controller/reconcile.go`
5. `internal/worker/manager.go`
6. `internal/events/hub.go`
7. `internal/http/routes.go`
8. `web/src/App.tsx`
9. `web/src/api/ws.ts`
10. `web/src/state/store.ts`

## Proposed Solution

<!-- Describe the proposed solution in detail -->

## Design Decisions

<!-- Document key design decisions and rationale -->

## Alternatives Considered

<!-- List alternative approaches that were considered and why they were rejected -->

## Implementation Plan

<!-- Outline the steps to implement this design -->

## Open Questions

<!-- List any unresolved questions or concerns -->

## References

<!-- Link to related documents, RFCs, or external resources -->
