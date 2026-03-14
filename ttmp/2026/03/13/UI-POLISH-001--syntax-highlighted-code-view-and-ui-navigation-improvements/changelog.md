# Changelog

## 2026-03-13

- Initial workspace created


## 2026-03-13

Steps 1-5: Backend sources endpoint, CodePanel with highlight.js, section tabs (Dashboard/Code/Logs), JSON colorization in DataPanel

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/internal/scenario/server/handler.go — Added sources sub-path to preset detail handler
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/components/CodePanel.tsx — New syntax-highlighted code viewer component
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/components/DataPanel.tsx — Colorized JSON renderer replacing plain stringify
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/components/ScenarioWorkbench.tsx — Restructured with section tabs and source fetching
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/workbench.css — Section tabs


## 2026-03-13

Step 6: Fix syntax highlighting (hljs.highlight + dangerouslySetInnerHTML), fix React key collisions in DataPanel, major CSS visual overhaul (commit b6230ca)

### Related Files

- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/components/CodePanel.tsx — Switched to hljs.highlight string API
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/components/DataPanel.tsx — String-based colorizeJSON eliminating key collisions
- /home/manuel/code/wesen/2026-03-13--pod-deployment-demo/ui/src/scenario/workbench.css — Major visual redesign - atmosphere

