import type { UIControl } from "./types";

export function renderControl(
  ctrl: UIControl,
  spec: Record<string, unknown>,
  onChange: (key: string, value: unknown) => void,
  index: number,
) {
  if (ctrl.type === "group") {
    return (
      <div className="wb-spec-group" key={`group-${index}`}>
        <div className="wb-spec-group-label">{ctrl.label}</div>
        {(ctrl.children ?? []).map((child, childIndex) =>
          renderControl(child, spec, onChange, childIndex),
        )}
      </div>
    );
  }

  const key = ctrl.key ?? `control-${index}`;
  const value = ctrl.key ? spec[ctrl.key] : undefined;

  if (ctrl.type === "slider" && ctrl.key) {
    return (
      <div className="wb-ctrl" key={key}>
        <div className="wb-ctrl-label">
          <span>{ctrl.label}</span>
          <span className="wb-ctrl-value">{String(value ?? "")}</span>
        </div>
        <input
          type="range"
          min={ctrl.min ?? 0}
          max={ctrl.max ?? 100}
          step={ctrl.step ?? 1}
          value={Number(value ?? 0)}
          onChange={(event) => onChange(ctrl.key!, Number(event.target.value))}
        />
      </div>
    );
  }

  if (ctrl.type === "toggle" && ctrl.key) {
    const on = Boolean(value);
    return (
      <div className="wb-ctrl" key={key}>
        <div className="wb-ctrl-toggle" onClick={() => onChange(ctrl.key!, !on)}>
          <span style={{ fontSize: "0.8rem", color: "#c8d5e6" }}>{ctrl.label}</span>
          <div className={`wb-toggle-track${on ? " on" : ""}`}>
            <div className="wb-toggle-thumb" />
          </div>
        </div>
      </div>
    );
  }

  if (ctrl.type === "buttons" && ctrl.key) {
    return (
      <div className="wb-ctrl" key={key}>
        <div className="wb-ctrl-label">
          <span>{ctrl.label}</span>
        </div>
        <div className="wb-btn-group">
          {(ctrl.options ?? []).map((option) => (
            <button
              key={option}
              className={`wb-btn-opt${value === option ? " active" : ""}`}
              onClick={() => onChange(ctrl.key!, option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (ctrl.type === "select" && ctrl.key) {
    return (
      <div className="wb-ctrl" key={key}>
        <div className="wb-ctrl-label">
          <span>{ctrl.label}</span>
        </div>
        <select
          className="wb-select"
          value={String(value ?? "")}
          onChange={(event) => onChange(ctrl.key!, event.target.value)}
        >
          {(ctrl.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return null;
}
