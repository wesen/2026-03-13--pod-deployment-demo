import type { ReactNode } from "react";

function colorizeJSON(value: unknown, indent = 0): ReactNode[] {
  const pad = "  ".repeat(indent);
  const nodes: ReactNode[] = [];
  let key = 0;

  if (value === null) {
    nodes.push(<span key={key++} className="wb-json-null">null</span>);
  } else if (typeof value === "boolean") {
    nodes.push(<span key={key++} className="wb-json-bool">{String(value)}</span>);
  } else if (typeof value === "number") {
    nodes.push(<span key={key++} className="wb-json-num">{String(value)}</span>);
  } else if (typeof value === "string") {
    nodes.push(<span key={key++} className="wb-json-str">"{value}"</span>);
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      nodes.push(<span key={key++} className="wb-json-bracket">[]</span>);
    } else {
      nodes.push(<span key={key++} className="wb-json-bracket">[</span>);
      nodes.push("\n");
      value.forEach((item, i) => {
        nodes.push(pad + "  ");
        nodes.push(...colorizeJSON(item, indent + 1));
        if (i < value.length - 1) nodes.push(<span key={`c${i}`} className="wb-json-punct">,</span>);
        nodes.push("\n");
      });
      nodes.push(pad);
      nodes.push(<span key={key++} className="wb-json-bracket">]</span>);
    }
  } else if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      nodes.push(<span key={key++} className="wb-json-bracket">{"{}"}</span>);
    } else {
      nodes.push(<span key={key++} className="wb-json-bracket">{"{"}</span>);
      nodes.push("\n");
      entries.forEach(([k, v], i) => {
        nodes.push(pad + "  ");
        nodes.push(<span key={`k${i}`} className="wb-json-key">"{k}"</span>);
        nodes.push(<span key={`s${i}`} className="wb-json-punct">: </span>);
        nodes.push(...colorizeJSON(v, indent + 1));
        if (i < entries.length - 1) nodes.push(<span key={`c${i}`} className="wb-json-punct">,</span>);
        nodes.push("\n");
      });
      nodes.push(pad);
      nodes.push(<span key={key++} className="wb-json-bracket">{"}"}</span>);
    }
  }

  return nodes;
}

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
            colorizeJSON(props.data)
          )}
        </pre>
      </div>
    </div>
  );
}
