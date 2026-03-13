package state

import (
	"fmt"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"github.com/manuel/wesen/pod-deployment-demo/internal/domain"
)

type Store struct {
	mu         sync.RWMutex
	idCounter  atomic.Uint64
	deployment domain.DeploymentSpec
	pods       map[string]*domain.Pod
	workers    map[string]*domain.Worker
	phase      domain.ReconcilePhase
	chaos      bool
	logs       []domain.LogEntry
}

func New(workerIDs []string) *Store {
	store := &Store{
		deployment: domain.DeploymentSpec{
			Name:     "web",
			Replicas: 3,
		},
		pods:    make(map[string]*domain.Pod),
		workers: make(map[string]*domain.Worker, len(workerIDs)),
		phase:   domain.PhaseIdle,
		logs:    make([]domain.LogEntry, 0, 64),
	}

	for _, workerID := range workerIDs {
		store.workers[workerID] = &domain.Worker{ID: workerID, Status: "ready"}
	}

	for i := 0; i < store.deployment.Replicas; i++ {
		workerID := workerIDs[i%len(workerIDs)]
		pod := domain.Pod{
			ID:       store.nextPodID(),
			Name:     store.nextPodName(),
			Phase:    domain.PodRunning,
			WorkerID: workerID,
		}
		store.pods[pod.ID] = &pod
		store.workers[workerID].PodCount++
	}

	store.appendLogLocked("watch", "Controller started - watching Deployment/web")
	return store
}

func (s *Store) Snapshot() domain.Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.snapshotLocked()
}

func (s *Store) Deployment() domain.DeploymentSpec {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.deployment
}

func (s *Store) UpdateDeploymentReplicas(replicas int) domain.DeploymentSpec {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.deployment.Replicas = replicas
	return s.deployment
}

func (s *Store) SetChaos(enabled bool) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.chaos = enabled
	return s.chaos
}

func (s *Store) ChaosEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.chaos
}

func (s *Store) SetPhase(phase domain.ReconcilePhase) domain.ReconcilePhase {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.phase = phase
	return s.phase
}

func (s *Store) AppendLog(logType, text string) domain.LogEntry {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.appendLogLocked(logType, text)
}

func (s *Store) RunningPods() []domain.Pod {
	s.mu.RLock()
	defer s.mu.RUnlock()

	pods := make([]domain.Pod, 0, len(s.pods))
	for _, pod := range s.pods {
		if pod.Phase == domain.PodRunning {
			pods = append(pods, *pod)
		}
	}

	sortPods(pods)
	return pods
}

func (s *Store) CreatePendingPod(workerID string) domain.Pod {
	s.mu.Lock()
	defer s.mu.Unlock()

	pod := domain.Pod{
		ID:       s.nextPodID(),
		Name:     s.nextPodName(),
		Phase:    domain.PodPending,
		WorkerID: workerID,
	}

	s.pods[pod.ID] = &pod
	if worker, ok := s.workers[workerID]; ok {
		worker.PodCount++
	}

	return pod
}

func (s *Store) MarkPodRunning(podID string) (domain.Pod, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pod, ok := s.pods[podID]
	if !ok {
		return domain.Pod{}, false
	}

	pod.Phase = domain.PodRunning
	return *pod, true
}

func (s *Store) MarkPodTerminating(podID string) (domain.Pod, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pod, ok := s.pods[podID]
	if !ok || pod.Phase != domain.PodRunning {
		return domain.Pod{}, false
	}

	pod.Phase = domain.PodTerminating
	return *pod, true
}

func (s *Store) DeletePod(podID string) (domain.Pod, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pod, ok := s.pods[podID]
	if !ok {
		return domain.Pod{}, false
	}

	delete(s.pods, podID)
	if worker, ok := s.workers[pod.WorkerID]; ok && worker.PodCount > 0 {
		worker.PodCount--
	}

	return *pod, true
}

func (s *Store) SelectVictims(count int) []domain.Pod {
	s.mu.RLock()
	defer s.mu.RUnlock()

	victims := make([]domain.Pod, 0, count)
	for _, pod := range s.pods {
		if pod.Phase == domain.PodRunning {
			victims = append(victims, *pod)
		}
	}

	sortPods(victims)
	if len(victims) > count {
		victims = victims[:count]
	}

	return victims
}

func (s *Store) RandomRunningPod() (domain.Pod, bool) {
	running := s.RunningPods()
	if len(running) == 0 {
		return domain.Pod{}, false
	}

	return running[0], true
}

func (s *Store) snapshotLocked() domain.Snapshot {
	pods := make([]domain.Pod, 0, len(s.pods))
	for _, pod := range s.pods {
		pods = append(pods, *pod)
	}
	sortPods(pods)

	workers := make([]domain.Worker, 0, len(s.workers))
	for _, worker := range s.workers {
		workers = append(workers, *worker)
	}
	slices.SortFunc(workers, func(a, b domain.Worker) int {
		return compareStrings(a.ID, b.ID)
	})

	logs := make([]domain.LogEntry, len(s.logs))
	copy(logs, s.logs)

	return domain.Snapshot{
		Deployment: s.deployment,
		Phase:      s.phase,
		Chaos:      s.chaos,
		Pods:       pods,
		Workers:    workers,
		Logs:       logs,
	}
}

func (s *Store) appendLogLocked(logType, text string) domain.LogEntry {
	entry := domain.LogEntry{
		TS:   time.Now().UTC().Format(time.RFC3339),
		Type: logType,
		Text: text,
	}

	s.logs = append(s.logs, entry)
	if len(s.logs) > 200 {
		s.logs = append([]domain.LogEntry(nil), s.logs[len(s.logs)-200:]...)
	}

	return entry
}

func (s *Store) nextPodID() string {
	return fmt.Sprintf("pod-%d", s.idCounter.Add(1))
}

func (s *Store) nextPodName() string {
	return fmt.Sprintf("web-%06d", s.idCounter.Add(1))
}

func sortPods(pods []domain.Pod) {
	slices.SortFunc(pods, func(a, b domain.Pod) int {
		return compareStrings(a.ID, b.ID)
	})
}

func compareStrings(a, b string) int {
	switch {
	case a < b:
		return -1
	case a > b:
		return 1
	default:
		return 0
	}
}
