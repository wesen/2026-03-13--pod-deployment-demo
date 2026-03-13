---
Title: "Reconciliation Loop Reference"
Slug: "reconciliation-loop-reference"
Short: "Detailed reference for the observe/compare/plan/execute model and the JavaScript sandbox contract."
Topics:
- pod-deployment-demo
- reconciliation
- scenario-runtime
- javascript
Commands:
- serve
- help
IsTopLevel: true
IsTemplate: false
ShowPerDefault: true
SectionType: GeneralTopic
Order: 40
---

This reference explains the conceptual core of the project: a reconciliation loop that is generic in Go and scenario-specific in JavaScript. If you only read one technical page before touching the runtime, read this one. It captures the invariant that holds the entire system together.

## The Fundamental Abstraction

This section covers the model behind every preset.

The runtime assumes every scenario can be described as a repeating four-stage loop:

1. observe the current world,
2. compare it to desired state,
3. plan a corrective action set,
4. execute that plan.

This is the project's fundamental abstraction. Everything else exists to support it: catalog loading packages the logic, the VM executes it, the session schedules it, the transport publishes it, and the UI renders it.

The value of this model is that it keeps reconciliation explainable. Instead of saying "the controller reconciled," the system can show which stage introduced surprising behavior.

## Inputs and Outputs Per Stage

This section covers the stable contract between the Go runtime and stage functions.

`observe(desired) -> actual`

Receives the current desired state and returns a JSON-like representation of the world as the scenario understands it.

`compare(desired, actual) -> diff`

Receives desired and actual state and returns a structured explanation of drift.

`plan(desired, actual, diff) -> actions`

Receives desired state, actual state, and diff, and returns an action list.

`execute(desired, actual, diff, actions) -> void`

Receives the full state of the tick and applies the action plan using sandbox-local state and logs.

The Go runtime does not inspect the meaning of these payloads beyond exporting and storing JSON-compatible values. That restraint is critical. It lets scenarios evolve without constantly widening the backend type system.

## Snapshot Semantics

This section covers what the workbench is actually rendering.

After a successful tick, the backend publishes a snapshot containing:

- preset metadata,
- UI control definitions,
- the tick counter,
- the current phase,
- desired state,
- actual state,
- diff,
- actions,
- per-tick logs,
- session state such as `running` and `speedMs`.

The UI is therefore a snapshot browser, not an independent simulator. When the workbench looks wrong, the first debugging question should always be: "is the snapshot wrong, or is the rendering wrong?"

## Why Hide Implementation in JavaScript

This section covers the design philosophy behind the sandbox.

The runtime wants to expose control flow without forcing every scenario to expose its entire implementation. That is why the project hides scenario-specific behavior inside JavaScript while still surfacing the observable products of that behavior.

For example:

- `compare.js` can hide a lot of business-specific reasoning, but it must still emit a readable diff.
- `execute.js` can manage internal counters or simulated state transitions, but it must still emit logs and produce consequences visible on later ticks.

This is the sweet spot for the demo. We preserve the illusion and flexibility of domain-specific internals while keeping the reconciliation envelope inspectable.

## Sandbox Guarantees and Limits

This section covers what the JS environment can depend on.

The sandbox offers:

- a fresh VM on preset creation, reset, or preset switch,
- stable host helpers for state, logging, and simple simulation utilities,
- plain JSON-like values crossing the Go/JS boundary.

The sandbox does not offer:

- arbitrary filesystem or network access,
- direct transport control,
- direct mutation of Go session internals,
- privileged access to the browser or UI state.

These limits are a feature, not a deficiency. They keep the runtime generic and keep scenario authors honest about where logic belongs.

## Failure Modes by Stage

This section covers how to reason about bugs without reading every line of code first.

If `actual` looks wrong, start with `observe.js`.

If `actual` looks right but the diff is nonsense, start with `compare.js`.

If the diff is right but the actions are weak or absurd, start with `plan.js`.

If the actions look right but the world does not change as expected, start with `execute.js` and any sandbox-local state it maintains.

This stage-oriented debugging model is the biggest practical benefit of the architecture. It turns "the controller is weird" into a much smaller question.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| The loop exists conceptually but is hard to see in practice | The preset outputs are too opaque | Make diffs, actions, and logs more structured and more operator-friendly |
| JavaScript feels like a black box | The preset is hiding too much without exposing enough artifacts | Surface the right consequences in `actual`, `diff`, `actions`, and log output |
| The Go runtime keeps accreting domain knowledge | The abstraction boundary is slipping | Push scenario-specific logic back into the stage files |
| Engineers argue about where a rule should live | The contract is being treated as incidental | Ask whether the rule is generic runtime mechanics or scenario meaning; that usually decides the layer immediately |

## See Also

- `scenario-demo help pod-deployment-demo`
- `scenario-demo help runtime-architecture`
- `scenario-demo help operating-the-demo`
- `scenario-demo help authoring-scenarios`
