---
Title: "Pod Deployment Demo"
Slug: "pod-deployment-demo"
Short: "High-signal overview and user guide for the scenario-driven reconciliation demo."
Topics:
- scenario-runtime
- frontend
- presets
- reconciliation
Commands:
- serve
- help
IsTopLevel: true
IsTemplate: false
ShowPerDefault: true
SectionType: GeneralTopic
Order: 10
---

This guide explains what the pod deployment demo is for, how to navigate it as a user, and why the project is built around a deliberately visible reconciliation loop. The application is not just a toy dashboard. It is a teaching and debugging environment for a controller-style system where the "thinking" stage is explicit, inspectable, and hot-swappable per scenario.

The central design choice is simple: the backend owns the state machine, while JavaScript supplies scenario logic. That split keeps the operational model stable in Go and lets each preset hide its domain-specific implementation behind four small JavaScript functions. The UI then renders the loop instead of trying to become the loop.

## What You Are Looking At

This section covers the product surface, how it behaves in practice, and why it matters when onboarding a new user.

When the server is running, the browser shows a workbench with four jobs:

- pick a preset that defines one scenario package,
- edit desired state through generated controls,
- drive the runtime with run, pause, step, reset, and speed controls,
- inspect the current desired state, observed state, diff, action plan, and logs.

That layout is intentionally opinionated. Most reconciliation systems hide the decision path inside controller internals and leave operators with only logs and side effects. This demo moves the entire loop into view so a user can answer, at any tick, "what did the controller see, what drift did it compute, and what did it decide to do about it?"

## Mental Model

This section covers the single most important concept in the project.

The demo treats each preset as a miniature controller package:

- `spec.json` is the desired state.
- `observe.js` produces a model of the actual world.
- `compare.js` turns the gap between desired and actual into an explicit diff.
- `plan.js` converts drift into a list of proposed actions.
- `execute.js` applies the actions inside the preset's private sandbox state and emits logs.

Go owns the loop that calls those stages. JavaScript owns the scenario-specific meaning of "healthy", "drift", and "actuation". That separation matters because it keeps the runtime generic. The Go backend never needs to know what a taco truck, pod replica set, or zombie fleet actually means. It only needs to know how to orchestrate observe, compare, plan, and execute.

## Why the JavaScript Boundary Exists

This section covers the architectural boundary that makes the project flexible.

The JavaScript layer is not an implementation accident. It is the extension mechanism. A preset can hide messy domain logic in JS without forcing the Go runtime to grow bespoke types, controller branches, or one-off business rules. The backend exposes a tiny host API and keeps the contract intentionally narrow:

- JSON-compatible inputs and outputs,
- a private key/value state store per VM,
- log emission,
- a few helper functions such as random number generation and rounding.

This is the right level of abstraction for a demo platform. It gives authors freedom to model interesting behavior while preventing the runtime from turning into an unbounded scripting host with deep access to server internals.

## How to Use the Project

This section covers the main ways people approach the demo.

If you are evaluating the product, start with `scenario-demo help operating-the-demo`. That page gets you from zero to a running workbench quickly.

If you are trying to understand the backend, go next to `scenario-demo help runtime-architecture`. That page explains how catalog loading, the session, the event hub, and transport fit together.

If you are trying to understand the core theory of the system, read `scenario-demo help reconciliation-loop-reference`. That page is the most detailed explanation of the reconciliation model and the JS sandbox contract.

If you want to build or change presets, continue to `scenario-demo help authoring-scenarios`.

## Project Shape

This section covers where to look in the repository when you need source-level context.

`cmd/scenario-demo`

Hosts the Cobra entrypoint and Glazed help integration.

`internal/app`

Builds the server from config, catalog, runtime session, and event hub.

`internal/scenario/catalog`

Loads preset directories from disk and turns them into a typed catalog.

`internal/scenario/runtime`

Runs the reconciliation loop, owns session state, and hosts the Goja sandbox.

`internal/scenario/server`

Exposes HTTP and WebSocket endpoints for the workbench.

`internal/web`

Serves the built frontend and embeds production assets into the Go binary.

`ui/`

Contains the React workbench that renders backend-authored snapshots.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| The app feels confusing on first load | The user does not yet have the reconciliation mental model | Read `scenario-demo help reconciliation-loop-reference` before debugging implementation details |
| The workbench looks alive but behavior feels inconsistent | The preset hides important semantics in JavaScript | Inspect the active preset's stage files and compare the runtime panels to the stage contracts |
| The UI and backend appear to disagree | The frontend is rendering stale or partial state | Compare the browser view with `/api/session/snapshot`; the backend snapshot is authoritative |
| Project docs feel duplicated | Legacy ticket docs are still in the tree | Use the embedded help pages as the primary docs; the old duplicate ticket bundles have been removed |

## See Also

- `scenario-demo help operating-the-demo`
- `scenario-demo help runtime-architecture`
- `scenario-demo help reconciliation-loop-reference`
- `scenario-demo help authoring-scenarios`
