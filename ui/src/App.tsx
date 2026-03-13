import { useEffect, useMemo, useState } from "react";

type Phase = "idle" | "fetch" | "compare" | "act" | "sleep";
type PodPhase = "pending" | "running" | "terminating";

type Deployment = {
  name: string;
  replicas: number;
};

type Pod = {
  id: string;
  name: string;
  phase: PodPhase;
  workerId: string;
};

type Worker = {
  id: string;
  status: string;
  podCount: number;
};

type LogEntry = {
  ts: string;
  type: string;
  text: string;
};

type Snapshot = {
  deployment: Deployment;
  phase: Phase;
  chaos: boolean;
  pods: Pod[];
  workers: Worker[];
  logs: LogEntry[];
};

type ServerEvent = {
  type: string;
  ts: string;
  payload: unknown;
};

const emptySnapshot: Snapshot = {
  deployment: { name: "web", replicas: 3 },
  phase: "idle",
  chaos: false,
  pods: [],
  workers: [],
  logs: [],
};

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;

    const applyEvent = (event: ServerEvent) => {
      setSnapshot((current) => reduceEvent(current, event));
    };

    const connect = async () => {
      try {
        const response = await fetch("/api/snapshot");
        const data = (await response.json()) as Snapshot;
        if (active) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "failed to fetch snapshot");
        }
      }

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${window.location.host}/ws`);

      socket.addEventListener("open", () => {
        if (active) {
          setConnected(true);
        }
      });

      socket.addEventListener("close", () => {
        if (active) {
          setConnected(false);
          window.setTimeout(connect, 1000);
        }
      });

      socket.addEventListener("message", (message) => {
        const event = JSON.parse(message.data) as ServerEvent;
        if (!active) return;

        applyEvent(event);
      });
    };

    void connect();

    return () => {
      active = false;
      socket?.close();
    };
  }, []);

  const podsByWorker = useMemo(() => {
    const groups = new Map<string, Pod[]>();
    snapshot.workers.forEach((worker) => groups.set(worker.id, []));
    snapshot.pods.forEach((pod) => {
      const group = groups.get(pod.workerId) ?? [];
      group.push(pod);
      groups.set(pod.workerId, group);
    });
    return groups;
  }, [snapshot.pods, snapshot.workers]);

  const runningCount = snapshot.pods.filter((pod) => pod.phase === "running").length;
  const pendingCount = snapshot.pods.filter((pod) => pod.phase === "pending").length;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Go backend + React frontend</p>
          <h1>Pod reconciliation control room</h1>
          <p className="hero-copy">
            The browser now renders backend truth. The controller, workers, pod lifecycle,
            and logs are all driven by the Go runtime over HTTP and WebSocket.
          </p>
        </div>
        <div className="status-card">
          <span className={connected ? "status-pill live" : "status-pill stale"}>
            {connected ? "ws connected" : "ws reconnecting"}
          </span>
          <span className="status-pill neutral">phase {snapshot.phase}</span>
          <span className="status-pill neutral">
            {snapshot.deployment.name} desired {snapshot.deployment.replicas}
          </span>
        </div>
      </section>

      <section className="layout">
        <div className="panel control-panel">
          <header className="panel-header">
            <div>
              <p className="panel-label">Control plane</p>
              <h2>Deployment/{snapshot.deployment.name}</h2>
            </div>
            <button
              className={snapshot.chaos ? "ghost danger" : "ghost"}
              onClick={() => void toggleChaos(!snapshot.chaos)}
            >
              {snapshot.chaos ? "Disable chaos" : "Enable chaos"}
            </button>
          </header>

          <div className="stat-grid">
            <Stat label="Desired" value={snapshot.deployment.replicas} accent="indigo" />
            <Stat label="Running" value={runningCount} accent="green" />
            <Stat label="Pending" value={pendingCount} accent="amber" />
          </div>

          <div className="phase-card">
            <p className="panel-label">Reconcile phase</p>
            <strong>{snapshot.phase.toUpperCase()}</strong>
            <p>{phaseExplanation(snapshot.phase)}</p>
          </div>

          <div>
            <p className="panel-label">Desired replicas</p>
            <div className="replica-row">
              {[0, 1, 2, 3, 4, 5, 6].map((replicas) => (
                <button
                  key={replicas}
                  className={replicas === snapshot.deployment.replicas ? "replica active" : "replica"}
                  onClick={() => void setReplicas(replicas)}
                >
                  {replicas}
                </button>
              ))}
            </div>
          </div>

          {error ? <p className="error-banner">{error}</p> : null}
        </div>

        <div className="panel worker-panel">
          <header className="panel-header">
            <div>
              <p className="panel-label">Workers</p>
              <h2>Goroutine node runtime</h2>
            </div>
            <span className="hint">Click a running pod to kill it</span>
          </header>

          <div className="worker-grid">
            {snapshot.workers.map((worker) => (
              <article key={worker.id} className="worker-card">
                <header className="worker-header">
                  <div>
                    <strong>{worker.id}</strong>
                    <p>{worker.status}</p>
                  </div>
                  <span>{worker.podCount} pods</span>
                </header>
                <div className="pod-grid">
                  {(podsByWorker.get(worker.id) ?? []).map((pod) => (
                    <button
                      key={pod.id}
                      className={`pod ${pod.phase}`}
                      disabled={pod.phase !== "running"}
                      onClick={() => void killPod(pod.id)}
                    >
                      <span>{pod.name}</span>
                      <small>{pod.phase}</small>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel logs-panel">
        <header className="panel-header">
          <div>
            <p className="panel-label">Controller log</p>
            <h2>Recent activity</h2>
          </div>
          <span className="hint">{snapshot.logs.length} entries</span>
        </header>
        <div className="log-list">
          {snapshot.logs.map((log, index) => (
            <div key={`${log.ts}-${index}`} className="log-line">
              <span>{new Date(log.ts).toLocaleTimeString()}</span>
              <code>{log.type}</code>
              <p>{log.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat(props: { label: string; value: number; accent: "indigo" | "green" | "amber" }) {
  return (
    <div className={`stat-card ${props.accent}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function phaseExplanation(phase: Phase) {
  switch (phase) {
    case "fetch":
      return "Reading desired deployment state before comparing replicas.";
    case "compare":
      return "Checking actual running pods against the desired replica count.";
    case "act":
      return "Creating or deleting pods to remove drift.";
    case "sleep":
      return "Waiting for the next reconcile trigger or worker event.";
    default:
      return "System is stable and waiting for work.";
  }
}

async function setReplicas(replicas: number) {
  await fetch("/api/deployments/web", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replicas }),
  });
}

async function toggleChaos(enabled: boolean) {
  await fetch("/api/chaos/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

async function killPod(podId: string) {
  await fetch(`/api/pods/${podId}/kill`, {
    method: "POST",
  });
}

function reduceEvent(current: Snapshot, event: ServerEvent): Snapshot {
  switch (event.type) {
    case "snapshot":
      return event.payload as Snapshot;
    case "deployment.updated":
      return { ...current, deployment: event.payload as Deployment };
    case "chaos.updated":
      return { ...current, chaos: (event.payload as { enabled: boolean }).enabled };
    case "reconcile.phase":
      return { ...current, phase: (event.payload as { phase: Phase }).phase };
    case "log.append":
      return { ...current, logs: [...current.logs, event.payload as LogEntry].slice(-200) };
    case "pod.created":
      return { ...current, pods: [...current.pods, event.payload as Pod] };
    case "pod.updated":
      return {
        ...current,
        pods: current.pods.map((pod) =>
          pod.id === (event.payload as Pod).id ? (event.payload as Pod) : pod,
        ),
      };
    case "pod.deleted":
      return {
        ...current,
        pods: current.pods.filter((pod) => pod.id !== (event.payload as Pod).id),
      };
    default:
      return current;
  }
}
