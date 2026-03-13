export function DataPanel(props: {
  label: string;
  data: unknown;
  accent: string;
  count?: number;
}) {
  const colorMap: Record<string, string> = {
    green: "var(--green)",
    amber: "var(--amber)",
    violet: "var(--wb-violet)",
  };
  const color = colorMap[props.accent] || "var(--muted)";

  const isEmpty =
    props.data == null ||
    (typeof props.data === "object" && Object.keys(props.data as object).length === 0);

  return (
    <div className="wb-panel">
      <div className="wb-panel-head">
        <span className="wb-panel-label" style={{ color }}>
          {props.label}
        </span>
        {props.count !== undefined && <span className="wb-panel-badge">{props.count}</span>}
      </div>
      <div className="wb-panel-body">
        <pre className="wb-data-pre">
          {isEmpty ? (
            <span style={{ color: "var(--muted)", fontStyle: "italic" }}>empty</span>
          ) : (
            JSON.stringify(props.data, null, 2)
          )}
        </pre>
      </div>
    </div>
  );
}
