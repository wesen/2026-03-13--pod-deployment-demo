package domain

type ReconcilePhase string

const (
	PhaseIdle    ReconcilePhase = "idle"
	PhaseFetch   ReconcilePhase = "fetch"
	PhaseCompare ReconcilePhase = "compare"
	PhaseAct     ReconcilePhase = "act"
	PhaseSleep   ReconcilePhase = "sleep"
)

type PodPhase string

const (
	PodPending     PodPhase = "pending"
	PodRunning     PodPhase = "running"
	PodTerminating PodPhase = "terminating"
)

type DeploymentSpec struct {
	Name     string `json:"name"`
	Replicas int    `json:"replicas"`
}

type Pod struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Phase    PodPhase `json:"phase"`
	WorkerID string   `json:"workerId"`
}

type Worker struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	PodCount int    `json:"podCount"`
}

type LogEntry struct {
	TS   string `json:"ts"`
	Type string `json:"type"`
	Text string `json:"text"`
}

type Snapshot struct {
	Deployment DeploymentSpec `json:"deployment"`
	Phase      ReconcilePhase `json:"phase"`
	Chaos      bool           `json:"chaos"`
	Pods       []Pod          `json:"pods"`
	Workers    []Worker       `json:"workers"`
	Logs       []LogEntry     `json:"logs"`
}

type Event struct {
	Type    string      `json:"type"`
	TS      string      `json:"ts"`
	Payload interface{} `json:"payload"`
}
