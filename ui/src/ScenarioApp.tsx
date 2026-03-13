import { useCallback, useEffect, useRef, useState } from "react";

/* ─── types ─── */

type PresetMeta = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

type Snapshot = {
  preset: { id: string; name: string; icon: string; description: string; initialTickMs: number };
  ui: UIControl[];
  tick: number;
  phase: string;
  desired: Record<string, unknown>;
  actual: Record<string, unknown>;
  diff: Record<string, unknown>;
  actions: unknown[];
  logs: string[];
  running: boolean;
  speedMs: number;
  allLogs: string[];
};

type ServerEvent = {
  type: string;
  ts: string;
  payload: unknown;
};

type UIControl = {
  type: string;
  key?: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  children?: UIControl[];
};

const EMPTY: Snapshot = {
  preset: { id: "", name: "", icon: "", description: "", initialTickMs: 1000 },
  ui: [],
  tick: 0,
  phase: "idle",
  desired: {},
  actual: {},
  diff: {},
  actions: [],
  logs: [],
  running: false,
  speedMs: 1000,
  allLogs: [],
};

/* ─── styles (scoped to .scenario-wb) ─── */

const css = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap');

.scenario-wb {
  --wb-mono: "JetBrains Mono", "IBM Plex Mono", "SFMono-Regular", monospace;
  --wb-sans: "DM Sans", "IBM Plex Sans", sans-serif;
  --wb-cyan: #5ce0d8;
  --wb-violet: #a78bfa;
  --wb-rose: #fb7185;
  --wb-surface: rgba(8, 16, 30, 0.72);
  --wb-surface-hi: rgba(14, 24, 42, 0.85);
  --wb-border: rgba(92, 224, 216, 0.12);
  --wb-border-hi: rgba(92, 224, 216, 0.28);
  --wb-glow: 0 0 40px rgba(92, 224, 216, 0.06);

  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 20px 48px;
  font-family: var(--wb-sans);
}

/* ── header ── */

.wb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;
  flex-wrap: wrap;
}

.wb-title {
  font-family: var(--wb-mono);
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--wb-cyan);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.wb-title-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--wb-cyan);
  box-shadow: 0 0 8px var(--wb-cyan);
}

.wb-title-dot.off { background: var(--muted); box-shadow: none; }
.wb-title-dot.error { background: var(--danger); box-shadow: 0 0 8px var(--danger); }

.wb-conn {
  font-family: var(--wb-mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--wb-border);
  background: var(--wb-surface);
  color: var(--muted);
}

.wb-conn.live { color: var(--green); border-color: rgba(74, 208, 125, 0.3); }

/* ── preset bar ── */

.wb-presets {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.wb-preset-card {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 14px;
  border: 1px solid var(--wb-border);
  background: var(--wb-surface);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--wb-sans);
  font-size: 0.88rem;
  white-space: nowrap;
}

.wb-preset-card:hover {
  border-color: var(--wb-border-hi);
  background: var(--wb-surface-hi);
}

.wb-preset-card.active {
  border-color: var(--wb-cyan);
  background: rgba(92, 224, 216, 0.08);
  box-shadow: 0 0 20px rgba(92, 224, 216, 0.08);
}

.wb-preset-icon { font-size: 1.3rem; }
.wb-preset-name { font-weight: 600; }
.wb-preset-desc { color: var(--muted); font-size: 0.78rem; margin-left: 4px; }

/* ── transport strip ── */

.wb-transport {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  margin-bottom: 16px;
  border-radius: 16px;
  border: 1px solid var(--wb-border);
  background: var(--wb-surface-hi);
  flex-wrap: wrap;
}

.wb-transport-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.95rem;
  padding: 0;
}

.wb-transport-btn:hover {
  border-color: var(--wb-cyan);
  background: rgba(92, 224, 216, 0.1);
}

.wb-transport-btn.active {
  background: rgba(74, 208, 125, 0.15);
  border-color: rgba(74, 208, 125, 0.5);
  color: var(--green);
}

.wb-transport-btn.danger:hover {
  border-color: var(--danger);
  background: rgba(255, 109, 99, 0.12);
}

.wb-sep {
  width: 1px;
  height: 24px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 4px;
}

.wb-tick-display {
  font-family: var(--wb-mono);
  font-size: 0.82rem;
  color: var(--wb-cyan);
  padding: 0 10px;
  min-width: 100px;
}

.wb-tick-display strong {
  font-size: 1.15rem;
  font-weight: 700;
}

.wb-phase-pill {
  font-family: var(--wb-mono);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(167, 139, 250, 0.12);
  color: var(--wb-violet);
  border: 1px solid rgba(167, 139, 250, 0.2);
}

.wb-phase-pill.running {
  background: rgba(74, 208, 125, 0.12);
  color: var(--green);
  border-color: rgba(74, 208, 125, 0.25);
}

.wb-speed-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.wb-speed-label {
  font-family: var(--wb-mono);
  font-size: 0.72rem;
  color: var(--muted);
  white-space: nowrap;
}

.wb-speed-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}

.wb-speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--wb-cyan);
  cursor: pointer;
  border: 2px solid rgba(8, 16, 30, 0.8);
}

/* ── main grid ── */

.wb-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  grid-template-rows: auto auto;
  gap: 14px;
  margin-bottom: 14px;
}

.wb-grid-spec { grid-row: 1 / 3; }

/* ── panels ── */

.wb-panel {
  border-radius: 18px;
  border: 1px solid var(--wb-border);
  background: var(--wb-surface);
  box-shadow: var(--wb-glow);
  overflow: hidden;
}

.wb-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.wb-panel-label {
  font-family: var(--wb-mono);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.wb-panel-badge {
  font-family: var(--wb-mono);
  font-size: 0.68rem;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--muted);
}

.wb-panel-body {
  padding: 14px 18px 18px;
}

/* ── spec editor (controls) ── */

.wb-spec-group {
  margin-bottom: 16px;
}

.wb-spec-group:last-child { margin-bottom: 0; }

.wb-spec-group-label {
  font-family: var(--wb-mono);
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--wb-cyan);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(92, 224, 216, 0.1);
}

.wb-ctrl {
  margin-bottom: 10px;
}

.wb-ctrl:last-child { margin-bottom: 0; }

.wb-ctrl-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 0.8rem;
  color: #c8d5e6;
}

.wb-ctrl-value {
  font-family: var(--wb-mono);
  font-size: 0.78rem;
  color: var(--wb-cyan);
  font-weight: 600;
}

.wb-ctrl input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  outline: none;
}

.wb-ctrl input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wb-cyan);
  cursor: pointer;
  border: 2px solid rgba(8, 16, 30, 0.9);
  box-shadow: 0 0 6px rgba(92, 224, 216, 0.3);
}

.wb-ctrl-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 6px 0;
}

.wb-toggle-track {
  width: 38px;
  height: 20px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  transition: all 0.2s;
}

.wb-toggle-track.on {
  background: rgba(92, 224, 216, 0.2);
  border-color: var(--wb-cyan);
}

.wb-toggle-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--muted);
  position: absolute;
  top: 2px;
  left: 2px;
  transition: all 0.2s;
}

.wb-toggle-track.on .wb-toggle-thumb {
  left: 20px;
  background: var(--wb-cyan);
}

.wb-btn-group {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.wb-btn-opt {
  padding: 5px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: var(--muted);
  font-size: 0.76rem;
  font-family: var(--wb-mono);
  cursor: pointer;
  transition: all 0.15s;
}

.wb-btn-opt:hover { border-color: rgba(255, 255, 255, 0.2); }

.wb-btn-opt.active {
  background: rgba(92, 224, 216, 0.12);
  border-color: var(--wb-cyan);
  color: var(--wb-cyan);
}

.wb-select {
  width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: var(--wb-mono);
  font-size: 0.78rem;
  outline: none;
}

.wb-select:focus { border-color: var(--wb-cyan); }

.wb-select option { background: #0a1628; }

/* ── JSON textarea (raw mode) ── */

.wb-json-toggle {
  font-family: var(--wb-mono);
  font-size: 0.66rem;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.wb-json-toggle:hover { color: var(--text); border-color: rgba(255,255,255,0.18); }
.wb-json-toggle.active { color: var(--wb-cyan); border-color: var(--wb-border-hi); }

.wb-json-area {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.3);
  color: var(--wb-cyan);
  font-family: var(--wb-mono);
  font-size: 0.76rem;
  line-height: 1.55;
  resize: vertical;
  outline: none;
}

.wb-json-area:focus { border-color: var(--wb-border-hi); }

.wb-json-save {
  margin-top: 8px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--wb-cyan);
  background: rgba(92, 224, 216, 0.08);
  color: var(--wb-cyan);
  font-family: var(--wb-mono);
  font-size: 0.72rem;
  cursor: pointer;
}

.wb-json-save:hover { background: rgba(92, 224, 216, 0.16); }

/* ── data panels ── */

.wb-data-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.wb-data-pre {
  font-family: var(--wb-mono);
  font-size: 0.74rem;
  line-height: 1.5;
  color: #c0cfe0;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 320px;
  overflow-y: auto;
}

.wb-data-pre::-webkit-scrollbar { width: 4px; }
.wb-data-pre::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

/* ── logs ── */

.wb-logs {
  margin-top: 14px;
}

.wb-log-scroll {
  max-height: 280px;
  overflow-y: auto;
  padding-right: 4px;
}

.wb-log-scroll::-webkit-scrollbar { width: 4px; }
.wb-log-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

.wb-log-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 0.78rem;
  transition: background 0.1s;
}

.wb-log-line:nth-child(odd) { background: rgba(255, 255, 255, 0.015); }

.wb-log-idx {
  font-family: var(--wb-mono);
  font-size: 0.66rem;
  color: rgba(157, 176, 202, 0.4);
  min-width: 28px;
  text-align: right;
}

.wb-log-text {
  color: #c8d5e6;
  font-family: var(--wb-mono);
  font-size: 0.76rem;
}

/* ── error strip ── */

.wb-error {
  padding: 10px 16px;
  margin-bottom: 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 109, 99, 0.3);
  background: rgba(255, 109, 99, 0.06);
  color: var(--danger);
  font-family: var(--wb-mono);
  font-size: 0.8rem;
}

/* ── pulse animation for running indicator ── */

@keyframes wb-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.wb-running-pulse {
  animation: wb-pulse 1.2s ease-in-out infinite;
}

/* ── responsive ── */

@media (max-width: 900px) {
  .wb-grid {
    grid-template-columns: 1fr;
  }
  .wb-grid-spec { grid-row: auto; }
  .wb-data-grid { grid-template-columns: 1fr; }
  .wb-transport { flex-wrap: wrap; }
  .wb-speed-group { margin-left: 0; width: 100%; margin-top: 8px; }
}
`;

/* ─── component ─── */

export function ScenarioApp() {
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawMode, setRawMode] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);

  // Fetch presets on mount.
  useEffect(() => {
    fetch("/api/presets")
      .then((r) => r.json())
      .then((data: PresetMeta[]) => setPresets(data))
      .catch(() => {});
  }, []);

  // WebSocket + initial snapshot.
  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;

    const connect = async () => {
      try {
        const r = await fetch("/api/session/snapshot");
        const data = (await r.json()) as Snapshot;
        if (active) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "connection failed");
      }

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${window.location.host}/ws`);

      socket.addEventListener("open", () => {
        if (active) setConnected(true);
      });

      socket.addEventListener("close", () => {
        if (active) {
          setConnected(false);
          window.setTimeout(connect, 1500);
        }
      });

      socket.addEventListener("message", (msg) => {
        if (!active) return;
        const event = JSON.parse(msg.data) as ServerEvent;
        setSnapshot((cur) => reduceEvent(cur, event));
      });
    };

    void connect();
    return () => {
      active = false;
      socket?.close();
    };
  }, []);

  // Auto-scroll logs.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [snapshot.allLogs?.length]);

  // Sync jsonDraft when desired changes externally (and not in raw mode).
  useEffect(() => {
    if (!rawMode) setJsonDraft(JSON.stringify(snapshot.desired, null, 2));
  }, [snapshot.desired, rawMode]);

  // ── API calls ──

  const switchPreset = useCallback(async (id: string) => {
    try {
      const next = await postForSnapshot("/api/session/preset", { presetId: id });
      setSnapshot(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to switch preset");
    }
  }, []);

  const run = useCallback(async () => {
    try {
      setSnapshot(await postForSnapshot("/api/session/run", {}));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to run session");
    }
  }, []);

  const pause = useCallback(async () => {
    try {
      setSnapshot(await postForSnapshot("/api/session/pause", {}));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to pause session");
    }
  }, []);

  const step = useCallback(async () => {
    try {
      setSnapshot(await postForSnapshot("/api/session/step", {}));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to step session");
    }
  }, []);

  const reset = useCallback(async () => {
    try {
      setSnapshot(await postForSnapshot("/api/session/reset", {}));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to reset session");
    }
  }, []);

  const setSpeed = useCallback(async (ms: number) => {
    try {
      setSnapshot(await postForSnapshot("/api/session/speed", { speedMs: ms }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to update speed");
    }
  }, []);

  const updateSpec = useCallback(async (spec: Record<string, unknown>) => {
    try {
      setSnapshot(await putForSnapshot("/api/session/spec", spec));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to update spec");
    }
  }, []);

  const updateSpecKey = useCallback(
    (key: string, value: unknown) => {
      const next = { ...snapshot.desired, [key]: value };
      void updateSpec(next);
    },
    [snapshot.desired, updateSpec],
  );

  const saveRawJson = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft);
      void updateSpec(parsed);
      setError(null);
    } catch {
      setError("Invalid JSON in spec editor");
    }
  }, [jsonDraft, updateSpec]);

  const activeUI = snapshot.ui ?? [];

  return (
    <>
      <style>{css}</style>
      <main className="scenario-wb">
        {/* ── Header ── */}
        <header className="wb-header">
          <h1 className="wb-title">
            <span
              className={`wb-title-dot${error ? " error" : connected ? "" : " off"}`}
            />
            Reconcile workbench
          </h1>
          <span className={`wb-conn${connected ? " live" : ""}`}>
            {connected ? "ws live" : "ws reconnecting"}
          </span>
        </header>

        {/* ── Error strip ── */}
        {error && <div className="wb-error">{error}</div>}

        {/* ── Preset selector ── */}
        <div className="wb-presets">
          {presets.map((p) => (
            <button
              key={p.id}
              className={`wb-preset-card${snapshot.preset?.id === p.id ? " active" : ""}`}
              onClick={() => void switchPreset(p.id)}
            >
              <span className="wb-preset-icon">{p.icon}</span>
              <span className="wb-preset-name">{p.name}</span>
              <span className="wb-preset-desc">{p.description}</span>
            </button>
          ))}
        </div>

        {/* ── Transport strip ── */}
        <div className="wb-transport">
          <button
            className={`wb-transport-btn${snapshot.running ? " active" : ""}`}
            onClick={() => void (snapshot.running ? pause() : run())}
            title={snapshot.running ? "Pause" : "Run"}
          >
            {snapshot.running ? "\u23F8" : "\u25B6"}
          </button>
          <button className="wb-transport-btn" onClick={() => void step()} title="Step">
            {"\u23ED"}
          </button>
          <button
            className="wb-transport-btn danger"
            onClick={() => void reset()}
            title="Reset"
          >
            {"\u23F9"}
          </button>

          <div className="wb-sep" />

          <div className="wb-tick-display">
            tick <strong>{snapshot.tick}</strong>
          </div>

          <span
            className={`wb-phase-pill${snapshot.running ? " running wb-running-pulse" : ""}`}
          >
            {snapshot.phase}
          </span>

          <div className="wb-speed-group">
            <span className="wb-speed-label">
              {snapshot.speedMs}ms
            </span>
            <input
              type="range"
              className="wb-speed-slider"
              min={50}
              max={3000}
              step={50}
              value={snapshot.speedMs}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
          </div>
        </div>

        {/* ── Main grid: spec + data ── */}
        <div className="wb-grid">
          {/* Spec panel (left rail) */}
          <div className="wb-panel wb-grid-spec">
            <div className="wb-panel-head">
              <span className="wb-panel-label">Desired spec</span>
              <button
                className={`wb-json-toggle${rawMode ? " active" : ""}`}
                onClick={() => setRawMode(!rawMode)}
              >
                {rawMode ? "controls" : "json"}
              </button>
            </div>
            <div className="wb-panel-body">
              {rawMode ? (
                <>
                  <textarea
                    className="wb-json-area"
                    value={jsonDraft}
                    onChange={(e) => setJsonDraft(e.target.value)}
                    spellCheck={false}
                  />
                  <button className="wb-json-save" onClick={saveRawJson}>
                    Apply JSON
                  </button>
                </>
              ) : activeUI.length > 0 ? (
                activeUI.map((ctrl, i) =>
                  renderControl(ctrl, snapshot.desired, updateSpecKey, i),
                )
              ) : (
                /* Fallback: auto-generate controls from spec keys */
                Object.entries(snapshot.desired).map(([key, val]) => (
                  <div className="wb-ctrl" key={key}>
                    <div className="wb-ctrl-label">
                      <span>{key}</span>
                      <span className="wb-ctrl-value">{String(val)}</span>
                    </div>
                    {typeof val === "boolean" ? (
                      <div
                        className="wb-ctrl-toggle"
                        onClick={() => updateSpecKey(key, !val)}
                      >
                        <div className={`wb-toggle-track${val ? " on" : ""}`}>
                          <div className="wb-toggle-thumb" />
                        </div>
                      </div>
                    ) : typeof val === "number" ? (
                      <input
                        type="range"
                        min={0}
                        max={Math.max(val * 3, 10)}
                        step={val % 1 !== 0 ? 0.1 : 1}
                        value={val}
                        onChange={(e) => updateSpecKey(key, Number(e.target.value))}
                      />
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Data panels (right) */}
          <div className="wb-data-grid">
            <DataPanel label="Actual" data={snapshot.actual} accent="green" />
            <DataPanel label="Diff" data={snapshot.diff} accent="amber" />
            <DataPanel
              label="Actions"
              data={snapshot.actions}
              accent="violet"
              count={snapshot.actions?.length ?? 0}
            />
          </div>
        </div>

        {/* ── Logs ── */}
        <div className="wb-panel wb-logs">
          <div className="wb-panel-head">
            <span className="wb-panel-label">Runtime log</span>
            <span className="wb-panel-badge">{snapshot.allLogs?.length ?? 0} entries</span>
          </div>
          <div className="wb-panel-body">
            <div className="wb-log-scroll">
              {(snapshot.allLogs ?? []).map((line, i) => (
                <div key={i} className="wb-log-line">
                  <span className="wb-log-idx">{i + 1}</span>
                  <span className="wb-log-text">{line}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

/* ─── sub-components ─── */

function DataPanel(props: {
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
        {props.count !== undefined && (
          <span className="wb-panel-badge">{props.count}</span>
        )}
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

function renderControl(
  ctrl: UIControl,
  spec: Record<string, unknown>,
  onChange: (key: string, value: unknown) => void,
  index: number,
) {
  if (ctrl.type === "group") {
    return (
      <div className="wb-spec-group" key={`group-${index}`}>
        <div className="wb-spec-group-label">{ctrl.label}</div>
        {(ctrl.children ?? []).map((child, ci) =>
          renderControl(child, spec, onChange, ci),
        )}
      </div>
    );
  }

  const key = ctrl.key!;
  const val = spec[key];

  if (ctrl.type === "slider") {
    return (
      <div className="wb-ctrl" key={key}>
        <div className="wb-ctrl-label">
          <span>{ctrl.label}</span>
          <span className="wb-ctrl-value">{String(val ?? "")}</span>
        </div>
        <input
          type="range"
          min={ctrl.min ?? 0}
          max={ctrl.max ?? 100}
          step={ctrl.step ?? 1}
          value={Number(val ?? 0)}
          onChange={(e) => onChange(key, Number(e.target.value))}
        />
      </div>
    );
  }

  if (ctrl.type === "toggle") {
    const on = Boolean(val);
    return (
      <div className="wb-ctrl" key={key}>
        <div className="wb-ctrl-toggle" onClick={() => onChange(key, !on)}>
          <span style={{ fontSize: "0.8rem", color: "#c8d5e6" }}>{ctrl.label}</span>
          <div className={`wb-toggle-track${on ? " on" : ""}`}>
            <div className="wb-toggle-thumb" />
          </div>
        </div>
      </div>
    );
  }

  if (ctrl.type === "buttons") {
    return (
      <div className="wb-ctrl" key={key}>
        <div className="wb-ctrl-label">
          <span>{ctrl.label}</span>
        </div>
        <div className="wb-btn-group">
          {(ctrl.options ?? []).map((opt) => (
            <button
              key={opt}
              className={`wb-btn-opt${val === opt ? " active" : ""}`}
              onClick={() => onChange(key, opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (ctrl.type === "select") {
    return (
      <div className="wb-ctrl" key={key}>
        <div className="wb-ctrl-label">
          <span>{ctrl.label}</span>
        </div>
        <select
          className="wb-select"
          value={String(val ?? "")}
          onChange={(e) => onChange(key, e.target.value)}
        >
          {(ctrl.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return null;
}

/* ─── helpers ─── */

function reduceEvent(current: Snapshot, event: ServerEvent): Snapshot {
  switch (event.type) {
    case "snapshot":
      return event.payload as Snapshot;
    case "snapshot.updated":
      return { ...current, ...(event.payload as Partial<Snapshot>) };
    case "preset.changed":
      return { ...current, ...(event.payload as Partial<Snapshot>), allLogs: [] };
    case "session.state": {
      return { ...current, ...(event.payload as Partial<Snapshot>) };
    }
    case "session.reset":
      return { ...current, ...(event.payload as Partial<Snapshot>), allLogs: [] };
    case "runtime.error": {
      const e = event.payload as { error: string };
      return { ...current, phase: "error:" + e.error };
    }
    default:
      return current;
  }
}

async function postForSnapshot(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as { snapshot?: Snapshot };
  if (!payload.snapshot) {
    throw new Error(`missing snapshot response from ${url}`);
  }

  return payload.snapshot;
}

async function putForSnapshot(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as { snapshot?: Snapshot };
  if (!payload.snapshot) {
    throw new Error(`missing snapshot response from ${url}`);
  }

  return payload.snapshot;
}
