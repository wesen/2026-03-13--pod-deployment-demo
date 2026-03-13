import { DataPanel } from "./DataPanel";

export function StatePanels(props: {
  actual: Record<string, unknown>;
  diff: Record<string, unknown>;
  actions: unknown[];
}) {
  return (
    <div className="wb-data-grid">
      <DataPanel label="Actual" data={props.actual} accent="green" />
      <DataPanel label="Diff" data={props.diff} accent="amber" />
      <DataPanel label="Actions" data={props.actions} accent="violet" count={props.actions.length} />
    </div>
  );
}
