# Changelog

## 2026-03-13

- Initial workspace created


## 2026-03-13

Created a new goja-focused research ticket, imported the scenario-runner source, and wrote a detailed intern guide for moving to a Go-hosted reconcile runtime with preset directories and goja VMs

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/design-doc/01-intern-guide-to-a-goja-driven-reconcile-runtime.md — Primary detailed design and implementation guide
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/reference/01-investigation-diary.md — Chronological investigation record
- /tmp/deployement-demo2.tsx — Imported source analyzed for preset and phase architecture


## 2026-03-13

Uploaded the goja runtime design bundle to reMarkable and verified the remote ticket folder

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/design-doc/01-intern-guide-to-a-goja-driven-reconcile-runtime.md — Included in the uploaded reMarkable bundle
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ttmp/2026/03/13/GOJA-RECONCILE-001--goja-scenario-runtime-for-reconcile-presets/reference/01-investigation-diary.md — Included in the uploaded reMarkable bundle


## 2026-03-13

Scaffolded the preset catalog layer and added two directory-backed scenario presets so the runtime can discover scenario metadata, UI schemas, and phase scripts from disk before the goja VM host is wired in

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/model/model.go — Shared preset metadata structures loaded by the catalog
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/catalog/catalog.go — Filesystem loader for scenario directories and phase scripts
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/catalog/catalog_test.go — Catalog coverage for preset discovery and phase loading
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/scenarios/space-station/scenario.json — First sample preset metadata
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/scenarios/taco-fleet/scenario.json — Second sample preset metadata
