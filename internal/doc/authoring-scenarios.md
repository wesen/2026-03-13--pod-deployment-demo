---
Title: "Authoring Scenarios"
Slug: "authoring-scenarios"
Short: "Reference for adding or modifying scenario presets consumed by the runtime and UI."
Topics:
- pod-deployment-demo
- presets
- scenario-runtime
Commands:
- serve
- help
IsTopLevel: false
IsTemplate: false
ShowPerDefault: true
SectionType: Application
---

This page explains how to add a new scenario preset and what each file is responsible for. It matters because the runtime is only as reliable as the preset package on disk. Missing files or fuzzy contracts show up as runtime instability later.

## Preset Directory Contract

This section covers the required file layout and why it is rigid.

Create a new subdirectory under `scenarios/` and include these files:

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

The catalog loader requires every file. There is no partial loading or optional phase support. That strictness is useful because it forces each preset to declare the complete reconcile loop instead of hiding missing behavior until runtime.

## Metadata and Spec

This section covers the non-code files that define identity and initial state.

`scenario.json` should provide a stable preset identifier plus human-readable name, icon, description, and any timing defaults used by the runtime. Keep the ID stable because the frontend and tests treat it as the canonical selector.

`spec.json` defines the initial desired state. Use plain JSON values and prefer shapes that are easy to inspect in the workbench. If a value is hard to reason about in a browser JSON editor, it will also be hard to debug during a reconcile failure.

`ui.json` declares the controls used to edit the spec. Align control names and field paths with the structure in `spec.json`; mismatches here produce confusing operator behavior because edits appear to succeed while mutating the wrong field.

## Stage Functions

This section covers how the JavaScript files should behave.

Write each stage as a focused function over JSON-compatible data:

- `observe.js` should read externalized desired state and synthesize the current world.
- `compare.js` should describe drift precisely, not just return booleans.
- `plan.js` should emit declarative actions rather than mutating state directly.
- `execute.js` should apply the plan and append meaningful log lines.

Keep the responsibilities narrow. When a preset mixes comparison logic into `execute.js` or hides actuation in `observe.js`, the workbench becomes much less useful because the displayed phases no longer match the actual behavior.

## Practical Authoring Rules

This section covers conventions that keep scenarios maintainable.

- Favor deterministic outputs for the same input. Randomness makes the workbench harder to trust.
- Return JSON-serializable values only. Anything else will fail at the transport boundary.
- Keep log messages operator-oriented. They should explain what the runtime just did and why.
- Model diffs explicitly. A rich diff leads to a readable plan and a more convincing demo.
- Rebuild the frontend only when UI schema or frontend code changes. Pure preset edits affect the backend runtime directly.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| New preset does not appear in the UI | The directory is missing one of the required files or `scenario.json` is invalid | Compare against an existing preset and restart the server to catch loader errors early |
| Control edits do not change the desired spec correctly | `ui.json` field bindings do not match `spec.json` | Inspect the field path definitions and verify the payload returned by `/api/session/spec` |
| The plan stage returns nonsense actions | `compare.js` is not producing a stable diff contract | Simplify the diff shape first, then rebuild `plan.js` around that contract |
| The runtime errors with JSON or type issues | A stage returned non-JSON-friendly values | Keep stage outputs to arrays, objects, strings, numbers, booleans, and null |

## See Also

- `glaze help pod-deployment-demo`
- `glaze help runtime-architecture`
- `glaze help operating-the-demo`
