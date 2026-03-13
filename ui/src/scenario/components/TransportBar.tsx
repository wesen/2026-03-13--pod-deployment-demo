export function TransportBar(props: {
  running: boolean;
  tick: number;
  phase: string;
  speedMs: number;
  onRunPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speedMs: number) => void;
}) {
  return (
    <div className="wb-transport">
      <button
        className={`wb-transport-btn${props.running ? " active" : ""}`}
        onClick={() => void props.onRunPause()}
        title={props.running ? "Pause" : "Run"}
      >
        {props.running ? "\u23F8" : "\u25B6"}
      </button>
      <button className="wb-transport-btn" onClick={() => void props.onStep()} title="Step">
        {"\u23ED"}
      </button>
      <button className="wb-transport-btn danger" onClick={() => void props.onReset()} title="Reset">
        {"\u23F9"}
      </button>

      <div className="wb-sep" />

      <div className="wb-tick-display">
        tick <strong>{props.tick}</strong>
      </div>

      <span className={`wb-phase-pill${props.running ? " running wb-running-pulse" : ""}`}>
        {props.phase}
      </span>

      <div className="wb-speed-group">
        <span className="wb-speed-label">{props.speedMs}ms</span>
        <input
          type="range"
          className="wb-speed-slider"
          min={50}
          max={3000}
          step={50}
          value={props.speedMs}
          onChange={(event) => props.onSpeedChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
