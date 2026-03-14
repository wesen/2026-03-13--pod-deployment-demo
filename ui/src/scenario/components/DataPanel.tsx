function colorizeJSON(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (value === null) {
    return '<span class="wb-json-null">null</span>';
  }
  if (typeof value === "boolean") {
    return `<span class="wb-json-bool">${value}</span>`;
  }
  if (typeof value === "number") {
    return `<span class="wb-json-num">${value}</span>`;
  }
  if (typeof value === "string") {
    const escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<span class="wb-json-str">"${escaped}"</span>`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '<span class="wb-json-bracket">[]</span>';
    const items = value
      .map((item) => pad + "  " + colorizeJSON(item, indent + 1))
      .join('<span class="wb-json-punct">,</span>\n');
    return `<span class="wb-json-bracket">[</span>\n${items}\n${pad}<span class="wb-json-bracket">]</span>`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '<span class="wb-json-bracket">{}</span>';
    const items = entries
      .map(([k, v]) => {
        const escaped = k.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return (
          pad +
          "  " +
          `<span class="wb-json-key">"${escaped}"</span>` +
          '<span class="wb-json-punct">: </span>' +
          colorizeJSON(v, indent + 1)
        );
      })
      .join('<span class="wb-json-punct">,</span>\n');
    return `<span class="wb-json-bracket">{</span>\n${items}\n${pad}<span class="wb-json-bracket">}</span>`;
  }
  return String(value);
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
        {isEmpty ? (
          <pre className="wb-data-pre">
            <span style={{ color: "var(--muted)", fontStyle: "italic" }}>empty</span>
          </pre>
        ) : (
          <pre
            className="wb-data-pre"
            dangerouslySetInnerHTML={{ __html: colorizeJSON(props.data) }}
          />
        )}
      </div>
    </div>
  );
}
