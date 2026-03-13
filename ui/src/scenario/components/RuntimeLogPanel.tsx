import type { RefObject } from "react";

export function RuntimeLogPanel(props: {
  lines: string[];
  logEndRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="wb-panel wb-logs">
      <div className="wb-panel-head">
        <span className="wb-panel-label">Runtime log</span>
        <span className="wb-panel-badge">{props.lines.length} entries</span>
      </div>
      <div className="wb-panel-body">
        <div className="wb-log-scroll">
          {props.lines.map((line, index) => (
            <div key={index} className="wb-log-line">
              <span className="wb-log-idx">{index + 1}</span>
              <span className="wb-log-text">{line}</span>
            </div>
          ))}
          <div ref={props.logEndRef} />
        </div>
      </div>
    </div>
  );
}
