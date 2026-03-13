import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = {
  bg: "#0a0e17",
  panel: "#111827",
  panelBorder: "#1e293b",
  controlPlane: "#6366f1",
  controlPlaneGlow: "rgba(99,102,241,0.15)",
  worker: "#0ea5e9",
  workerGlow: "rgba(14,165,233,0.12)",
  pod: "#22c55e",
  podPending: "#eab308",
  podTerminating: "#ef4444",
  text: "#e2e8f0",
  textMuted: "#64748b",
  textDim: "#475569",
  accent: "#a78bfa",
  line: "#1e293b",
  success: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",
};

const FONT = `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace`;
const FONT_SANS = `'DM Sans', 'Segoe UI', sans-serif`;

// Unique ID generator
let _id = 0;
const uid = () => `pod-${++_id}`;

const LogLine = ({ text, type = "info", ts }) => {
  const colorMap = { info: COLORS.textMuted, create: COLORS.success, delete: COLORS.danger, watch: COLORS.accent, reconcile: COLORS.controlPlane };
  return (
    <div style={{ fontFamily: FONT, fontSize: 11, color: colorMap[type] || COLORS.textMuted, padding: "2px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
      <span style={{ color: COLORS.textDim, marginRight: 8 }}>{ts}</span>
      {text}
    </div>
  );
};

const PodIcon = ({ status, name, style = {}, onClick }) => {
  const color = status === "running" ? COLORS.pod : status === "pending" ? COLORS.podPending : COLORS.podTerminating;
  const scale = status === "terminating" ? "scale(0.85)" : status === "pending" ? "scale(0.9)" : "scale(1)";
  return (
    <div
      onClick={onClick}
      title={`${name} (${status}) — click to kill`}
      style={{
        width: 52, height: 52, borderRadius: 10, background: `linear-gradient(135deg, ${color}22, ${color}11)`,
        border: `1.5px solid ${color}55`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: status === "running" ? "pointer" : "default", transition: "all 0.4s cubic-bezier(.4,0,.2,1)",
        transform: scale, position: "relative", ...style,
        boxShadow: status === "running" ? `0 0 12px ${color}33` : "none",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6M9 12h6M9 15h4" />
      </svg>
      <span style={{ fontFamily: FONT, fontSize: 7, color, marginTop: 2, letterSpacing: 0.3 }}>
        {name.slice(-6)}
      </span>
      {status === "pending" && (
        <div style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: COLORS.podPending, animation: "pulse 1s infinite" }} />
      )}
    </div>
  );
};

const StatBox = ({ label, value, color }) => (
  <div style={{ textAlign: "center", padding: "8px 16px" }}>
    <div style={{ fontFamily: FONT, fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
    <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.textDim, marginTop: 4, textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</div>
  </div>
);

export default function KubernetesDemo() {
  const [desiredReplicas, setDesiredReplicas] = useState(3);
  const [pods, setPods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [reconciling, setReconciling] = useState(false);
  const [loopPhase, setLoopPhase] = useState("idle"); // idle, fetch, compare, act, sleep
  const [autoMode, setAutoMode] = useState(true);
  const [chaosMode, setChaosMode] = useState(false);
  const logsEndRef = useRef(null);
  const podsRef = useRef(pods);
  podsRef.current = pods;
  const desiredRef = useRef(desiredReplicas);
  desiredRef.current = desiredReplicas;

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  };

  const addLog = useCallback((text, type = "info") => {
    setLogs((prev) => [...prev.slice(-60), { text, type, ts: now(), id: Math.random() }]);
  }, []);

  // Scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Initialize pods
  useEffect(() => {
    const initial = Array.from({ length: 3 }, () => ({ id: uid(), name: `web-${Math.random().toString(36).slice(2, 8)}`, status: "running" }));
    setPods(initial);
    addLog("Controller started — watching Deployment/web", "watch");
  }, []);

  // Reconciliation loop
  const reconcile = useCallback(async () => {
    if (reconciling) return;
    setReconciling(true);

    // Phase 1: Fetch desired state
    setLoopPhase("fetch");
    addLog(`GET Deployment/web → spec.replicas=${desiredRef.current}`, "reconcile");
    await new Promise((r) => setTimeout(r, 600));

    // Phase 2: List actual pods
    const currentPods = podsRef.current.filter((p) => p.status === "running");
    addLog(`LIST Pods(app=web) → found ${currentPods.length} running`, "reconcile");
    await new Promise((r) => setTimeout(r, 400));

    // Phase 3: Compare
    setLoopPhase("compare");
    const diff = desiredRef.current - currentPods.length;
    if (diff === 0) {
      addLog(`✓ State converged: ${currentPods.length}/${desiredRef.current} replicas`, "info");
    } else {
      addLog(`Δ drift detected: have ${currentPods.length}, want ${desiredRef.current} (${diff > 0 ? "+" : ""}${diff})`, "reconcile");
    }
    await new Promise((r) => setTimeout(r, 500));

    // Phase 4: Act
    setLoopPhase("act");
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        const name = `web-${Math.random().toString(36).slice(2, 8)}`;
        const newPod = { id: uid(), name, status: "pending" };
        setPods((prev) => [...prev, newPod]);
        addLog(`CREATE Pod/${name} from template`, "create");
        await new Promise((r) => setTimeout(r, 350));
        // Transition to running
        setTimeout(() => {
          setPods((prev) => prev.map((p) => (p.name === name ? { ...p, status: "running" } : p)));
        }, 800 + i * 200);
      }
    } else if (diff < 0) {
      const toRemove = currentPods.slice(0, Math.abs(diff));
      for (const pod of toRemove) {
        setPods((prev) => prev.map((p) => (p.id === pod.id ? { ...p, status: "terminating" } : p)));
        addLog(`DELETE Pod/${pod.name}`, "delete");
        await new Promise((r) => setTimeout(r, 300));
        setTimeout(() => {
          setPods((prev) => prev.filter((p) => p.id !== pod.id));
        }, 900);
      }
    }

    await new Promise((r) => setTimeout(r, 400));
    setLoopPhase("sleep");
    addLog("Sleeping until next watch event or resync…", "watch");
    await new Promise((r) => setTimeout(r, 600));

    setLoopPhase("idle");
    setReconciling(false);
  }, [reconciling, addLog]);

  // Auto reconcile loop
  useEffect(() => {
    if (!autoMode) return;
    const interval = setInterval(() => {
      reconcile();
    }, 3500);
    return () => clearInterval(interval);
  }, [autoMode, reconcile]);

  // Chaos monkey
  useEffect(() => {
    if (!chaosMode) return;
    const interval = setInterval(() => {
      const running = podsRef.current.filter((p) => p.status === "running");
      if (running.length > 0) {
        const victim = running[Math.floor(Math.random() * running.length)];
        addLog(`☠ CHAOS: killed Pod/${victim.name}`, "delete");
        setPods((prev) => prev.filter((p) => p.id !== victim.id));
      }
    }, 5000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [chaosMode, addLog]);

  const killPod = (pod) => {
    if (pod.status !== "running") return;
    addLog(`Manual kill: Pod/${pod.name}`, "delete");
    setPods((prev) => prev.filter((p) => p.id !== pod.id));
  };

  const runningCount = pods.filter((p) => p.status === "running").length;
  const pendingCount = pods.filter((p) => p.status === "pending").length;

  const phaseLabels = { idle: "IDLE", fetch: "FETCHING DESIRED STATE", compare: "COMPARING STATE", act: "RECONCILING", sleep: "WATCHING" };
  const phaseColors = { idle: COLORS.textDim, fetch: COLORS.controlPlane, compare: COLORS.accent, act: COLORS.warning, sleep: COLORS.textMuted };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", color: COLORS.text, fontFamily: FONT_SANS, padding: "24px 20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes scanline { 0% { transform: translateY(-100%) } 100% { transform: translateY(100%) } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 8px rgba(99,102,241,0.3) } 50% { box-shadow: 0 0 20px rgba(99,102,241,0.6) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.panelBorder}; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill={COLORS.controlPlane} opacity="0.8" />
            <path d="M2 17l10 5 10-5" stroke={COLORS.controlPlane} strokeWidth="1.5" fill="none" />
            <path d="M2 12l10 5 10-5" stroke={COLORS.controlPlane} strokeWidth="1.5" fill="none" opacity="0.6" />
          </svg>
          <h1 style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, letterSpacing: -0.5, margin: 0 }}>
            Kubernetes Reconciliation Loop
          </h1>
        </div>
        <p style={{ fontFamily: FONT, fontSize: 11, color: COLORS.textDim, margin: "0 0 24px 40px", letterSpacing: 0.3 }}>
          Deployment controller • desired state → actual state convergence
        </p>

        {/* Main Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, marginBottom: 16 }}>

          {/* LEFT: Control Plane */}
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12,
            padding: 20, position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: `linear-gradient(90deg, ${COLORS.controlPlane}, ${COLORS.accent})`,
              opacity: reconciling ? 1 : 0.3, transition: "opacity 0.5s",
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", background: COLORS.controlPlane,
                animation: reconciling ? "glow 1.5s infinite" : "none",
                boxShadow: `0 0 8px ${COLORS.controlPlane}55`,
              }} />
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: COLORS.controlPlane }}>
                Control Plane
              </span>
            </div>

            {/* Loop Phase Indicator */}
            <div style={{
              background: `${phaseColors[loopPhase]}11`, border: `1px solid ${phaseColors[loopPhase]}33`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 16, transition: "all 0.3s",
            }}>
              <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
                Loop Phase
              </div>
              <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: phaseColors[loopPhase] }}>
                {phaseLabels[loopPhase]}
              </div>
            </div>

            {/* Pseudocode */}
            <div style={{
              background: "#080c14", borderRadius: 8, padding: 12, marginBottom: 16,
              fontFamily: FONT, fontSize: 10, lineHeight: 1.7, color: COLORS.textDim,
              border: `1px solid ${COLORS.panelBorder}`,
            }}>
              <div style={{ color: loopPhase === "fetch" ? COLORS.controlPlane : "inherit", transition: "color 0.3s" }}>
                <span style={{ color: "#c084fc" }}>desired</span> = api.get(<span style={{ color: "#fbbf24" }}>"Deployment"</span>)
              </div>
              <div style={{ color: loopPhase === "fetch" ? COLORS.controlPlane : "inherit", transition: "color 0.3s" }}>
                <span style={{ color: "#c084fc" }}>actual</span> &nbsp;= api.list(<span style={{ color: "#fbbf24" }}>"Pod"</span>)
              </div>
              <div style={{ color: loopPhase === "compare" ? COLORS.accent : "inherit", transition: "color 0.3s" }}>
                <span style={{ color: "#f472b6" }}>if</span> count ≠ replicas:
              </div>
              <div style={{ color: loopPhase === "act" ? COLORS.warning : "inherit", paddingLeft: 12, transition: "color 0.3s" }}>
                → create / delete pods
              </div>
              <div style={{ color: loopPhase === "sleep" ? COLORS.textMuted : "inherit", transition: "color 0.3s" }}>
                sleep_until_event()
              </div>
            </div>

            {/* Desired Replicas */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                spec.replicas
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button key={n} onClick={() => setDesiredReplicas(n)} style={{
                    width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${n === desiredReplicas ? COLORS.controlPlane : COLORS.panelBorder}`,
                    background: n === desiredReplicas ? `${COLORS.controlPlane}22` : "transparent",
                    color: n === desiredReplicas ? COLORS.controlPlane : COLORS.textMuted,
                    fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                  }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", justifyContent: "space-around", borderTop: `1px solid ${COLORS.panelBorder}`, paddingTop: 14, marginBottom: 16 }}>
              <StatBox label="Desired" value={desiredReplicas} color={COLORS.controlPlane} />
              <StatBox label="Running" value={runningCount} color={runningCount === desiredReplicas ? COLORS.success : COLORS.warning} />
              <StatBox label="Pending" value={pendingCount} color={COLORS.podPending} />
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setAutoMode(!autoMode)} style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${autoMode ? COLORS.success + "55" : COLORS.panelBorder}`,
                background: autoMode ? `${COLORS.success}15` : "transparent",
                color: autoMode ? COLORS.success : COLORS.textMuted,
                fontFamily: FONT, fontSize: 10, fontWeight: 600, cursor: "pointer", letterSpacing: 0.5,
              }}>
                {autoMode ? "⏸ AUTO" : "▶ AUTO"}
              </button>
              <button onClick={() => !reconciling && reconcile()} disabled={reconciling} style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.controlPlane}44`,
                background: `${COLORS.controlPlane}15`, color: reconciling ? COLORS.textDim : COLORS.controlPlane,
                fontFamily: FONT, fontSize: 10, fontWeight: 600, cursor: reconciling ? "not-allowed" : "pointer", letterSpacing: 0.5,
              }}>
                ↻ RECONCILE
              </button>
              <button onClick={() => setChaosMode(!chaosMode)} style={{
                flex: 1, padding: "8px 12px", borderRadius: 8, border: `1px solid ${chaosMode ? COLORS.danger + "55" : COLORS.panelBorder}`,
                background: chaosMode ? `${COLORS.danger}15` : "transparent",
                color: chaosMode ? COLORS.danger : COLORS.textMuted,
                fontFamily: FONT, fontSize: 10, fontWeight: 600, cursor: "pointer", letterSpacing: 0.5,
              }}>
                {chaosMode ? "☠ CHAOS" : "☠ CHAOS"}
              </button>
            </div>
          </div>

          {/* RIGHT: Worker Nodes */}
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12,
            padding: 20, position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: `linear-gradient(90deg, ${COLORS.worker}, ${COLORS.pod})`,
              opacity: 0.4,
            }} />

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.worker, boxShadow: `0 0 8px ${COLORS.worker}55` }} />
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1.5, color: COLORS.worker }}>
                Worker Nodes
              </span>
              <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.textDim, marginLeft: "auto" }}>
                click pod to simulate crash
              </span>
            </div>

            {/* Pods Grid */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 10, minHeight: 140, alignContent: "flex-start",
              padding: 16, background: `${COLORS.bg}88`, borderRadius: 10, border: `1px dashed ${COLORS.panelBorder}`,
            }}>
              {pods.length === 0 && (
                <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.textDim, margin: "auto", textAlign: "center" }}>
                  No pods scheduled
                </div>
              )}
              {pods.map((pod) => (
                <PodIcon key={pod.id} status={pod.status} name={pod.name} onClick={() => killPod(pod)} />
              ))}
            </div>

            {/* Convergence Bar */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: FONT, fontSize: 9, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1 }}>
                  Convergence
                </span>
                <span style={{ fontFamily: FONT, fontSize: 9, color: runningCount === desiredReplicas ? COLORS.success : COLORS.warning }}>
                  {runningCount}/{desiredReplicas}
                </span>
              </div>
              <div style={{ height: 4, background: COLORS.bg, borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2, transition: "all 0.6s cubic-bezier(.4,0,.2,1)",
                  width: `${Math.min(100, (runningCount / Math.max(desiredReplicas, 1)) * 100)}%`,
                  background: runningCount === desiredReplicas
                    ? `linear-gradient(90deg, ${COLORS.success}, ${COLORS.success}cc)`
                    : runningCount > desiredReplicas
                      ? `linear-gradient(90deg, ${COLORS.danger}, ${COLORS.warning})`
                      : `linear-gradient(90deg, ${COLORS.warning}, ${COLORS.podPending})`,
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div style={{
          background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 12,
          padding: "14px 16px", maxHeight: 180, overflowY: "auto",
        }}>
          <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>
            Controller Logs
          </div>
          {logs.map((log) => (
            <LogLine key={log.id} text={log.text} type={log.type} ts={log.ts} />
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
