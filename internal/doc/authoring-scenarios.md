---
Title: "JavaScript Scenario Authoring"
Slug: "authoring-scenarios"
Short: "Reference for authoring presets inside the JavaScript sandbox without leaking scenario-specific logic into Go."
Topics:
- pod-deployment-demo
- presets
- scenario-runtime
- javascript
Commands:
- serve
- help
IsTopLevel: false
IsTemplate: false
ShowPerDefault: true
SectionType: Application
Order: 50
---

This guide explains how to author scenario presets correctly inside the JavaScript sandbox. The goal is not only to make a preset work, but to keep scenario-specific logic hidden in the right place. A good preset teaches the demo something interesting without forcing the Go runtime to know anything about that domain.

## The Preset Contract

This section covers the file layout and why every file exists.

Each preset lives in its own directory:

```text
scenarios/<preset-id>/
  scenario.json
  spec.json
  ui.json
  observe.js
  compare.js
  plan.js
  execute.js
```

The loader treats this as a complete package, not a loose collection of optional files. That rigidity matters because the runtime wants every preset to speak the same language even when the internal logic is wildly different.

## What Belongs in Go and What Belongs in JavaScript

This section covers the most important authoring rule in the project.

Put stable runtime mechanics in Go:

- session lifecycle,
- tick timing,
- snapshot publication,
- API endpoints,
- event fanout,
- frontend transport contract.

Put scenario meaning in JavaScript:

- how to observe the world,
- how to define drift,
- how to turn drift into actions,
- how actions mutate the scenario's private state,
- what logs should explain to the operator.

If you find yourself wanting to add a Go `switch` on preset ID, that is almost always a design smell. The scenario is trying to escape the sandbox.

## Stage Design Guidance

This section covers how to keep the four files coherent.

`observe.js`

Keep this stage focused on reading the current world. It should answer "what is true right now?" rather than "what should we do about it?"

`compare.js`

Make drift explicit. Rich diffs are worth the extra effort because they create readable plans and make the workbench more educational.

`plan.js`

Emit declarative actions. The plan should be understandable to a human scanning the actions panel. Avoid hiding major side effects here.

`execute.js`

Apply the plan and log what happened. This stage can maintain internal sandbox state through `getState` and `setState`, but it should still leave the operator with a readable trail of actions.

## Sandbox API Reference

This section covers the host functions available to JS and why they are constrained.

The Go host exposes:

- `getState(key)` to read sandbox-local state,
- `setState(key, value)` to write sandbox-local state,
- `log(message)` to emit operator-visible log lines,
- `randomFloat(min, max)` and `randomInt(min, max)` for simulation behavior,
- `round(value, decimals)` for simple numeric cleanup.

These helpers are intentionally small. They give presets enough power to simulate interesting systems without giving them broad access to the server process. The sandbox is there to contain scenario behavior, not to become a second backend.

## Authoring Heuristics

This section covers practices that make presets easier to understand.

- Favor deterministic logic unless randomness is part of the lesson.
- Keep outputs JSON-friendly.
- Make the diff richer before making the plan cleverer.
- Write logs for the operator, not for the implementer.
- Let `execute.js` own hidden internal mechanics, but expose meaningful outcomes through actions and logs.

The last point matters most. The project is strongest when implementation detail can stay hidden in JavaScript while operational meaning remains visible at the workbench layer.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| A preset works but is impossible to understand from the UI | Too much meaning is hidden in opaque JS internals | Surface more intent through explicit diff structures, action objects, and log lines |
| The Go runtime keeps gaining preset-specific conditionals | Scenario logic is leaking out of the sandbox | Move the domain rule back into one of the four JS stages |
| The plan panel is noisy but not useful | `plan.js` is returning low-value actions | Make action objects more declarative and aligned with operator language |
| Reset does not restore expected behavior | Important mutable state lives outside the sandbox contract | Revisit `getState`/`setState` usage and ensure the preset can rebuild from `spec.json` cleanly |

## See Also

- `scenario-demo help reconciliation-loop-reference`
- `scenario-demo help runtime-architecture`
- `scenario-demo help operating-the-demo`
