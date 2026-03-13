import { renderControl } from "../renderControl";
import type { UIControl } from "../types";

export function SpecPanel(props: {
  rawMode: boolean;
  jsonDraft: string;
  desired: Record<string, unknown>;
  ui: UIControl[];
  onToggleMode: () => void;
  onJsonDraftChange: (value: string) => void;
  onSaveRawJSON: () => void;
  onUpdateSpecKey: (key: string, value: unknown) => void;
}) {
  return (
    <div className="wb-panel wb-grid-spec">
      <div className="wb-panel-head">
        <span className="wb-panel-label">Desired spec</span>
        <button className={`wb-json-toggle${props.rawMode ? " active" : ""}`} onClick={props.onToggleMode}>
          {props.rawMode ? "controls" : "json"}
        </button>
      </div>
      <div className="wb-panel-body">
        {props.rawMode ? (
          <>
            <textarea
              className="wb-json-area"
              value={props.jsonDraft}
              onChange={(event) => props.onJsonDraftChange(event.target.value)}
              spellCheck={false}
            />
            <button className="wb-json-save" onClick={props.onSaveRawJSON}>
              Apply JSON
            </button>
          </>
        ) : props.ui.length > 0 ? (
          props.ui.map((control, index) =>
            renderControl(control, props.desired, props.onUpdateSpecKey, index),
          )
        ) : (
          Object.entries(props.desired).map(([key, value]) => (
            <div className="wb-ctrl" key={key}>
              <div className="wb-ctrl-label">
                <span>{key}</span>
                <span className="wb-ctrl-value">{String(value)}</span>
              </div>
              {typeof value === "boolean" ? (
                <div className="wb-ctrl-toggle" onClick={() => props.onUpdateSpecKey(key, !value)}>
                  <div className={`wb-toggle-track${value ? " on" : ""}`}>
                    <div className="wb-toggle-thumb" />
                  </div>
                </div>
              ) : typeof value === "number" ? (
                <input
                  type="range"
                  min={0}
                  max={Math.max(value * 3, 10)}
                  step={value % 1 !== 0 ? 0.1 : 1}
                  value={value}
                  onChange={(event) => props.onUpdateSpecKey(key, Number(event.target.value))}
                />
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
