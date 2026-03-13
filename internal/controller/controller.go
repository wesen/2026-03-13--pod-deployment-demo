package controller

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/manuel/wesen/pod-deployment-demo/internal/domain"
	"github.com/manuel/wesen/pod-deployment-demo/internal/events"
	"github.com/manuel/wesen/pod-deployment-demo/internal/state"
	"github.com/manuel/wesen/pod-deployment-demo/internal/worker"
)

type Controller struct {
	store       *state.Store
	hub         *events.Hub
	workers     *worker.Manager
	triggerCh   chan string
	rrIndex     atomic.Uint64
	reconcileMu sync.Mutex
}

func New(store *state.Store, hub *events.Hub, workers *worker.Manager) *Controller {
	return &Controller{
		store:     store,
		hub:       hub,
		workers:   workers,
		triggerCh: make(chan string, 16),
	}
}

func (c *Controller) Start(ctx context.Context) {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.reconcile("periodic resync")
		case reason := <-c.triggerCh:
			c.reconcile(reason)
		}
	}
}

func (c *Controller) Trigger(reason string) {
	select {
	case c.triggerCh <- reason:
	default:
	}
}

func (c *Controller) reconcile(reason string) {
	c.reconcileMu.Lock()
	defer c.reconcileMu.Unlock()

	c.setPhase(domain.PhaseFetch)
	desired := c.store.Deployment().Replicas

	c.setPhase(domain.PhaseCompare)
	running := c.store.RunningPods()
	diff := desired - len(running)

	c.publishLog("reconcile", fmt.Sprintf("Reconcile trigger=%s desired=%d running=%d diff=%d", reason, desired, len(running), diff))

	c.setPhase(domain.PhaseAct)
	switch {
	case diff > 0:
		for i := 0; i < diff; i++ {
			workerID := c.nextWorkerID()
			pod := c.store.CreatePendingPod(workerID)
			c.hub.Publish("pod.created", pod)
			c.publishLog("create", fmt.Sprintf("CREATE Pod/%s on %s", pod.Name, workerID))
			if err := c.workers.Send(worker.SpawnPod{WorkerID: workerID, PodID: pod.ID}); err != nil {
				c.publishLog("error", fmt.Sprintf("failed to dispatch spawn for %s: %v", pod.Name, err))
			}
		}
	case diff < 0:
		victims := c.store.SelectVictims(-diff)
		for _, pod := range victims {
			updated, ok := c.store.MarkPodTerminating(pod.ID)
			if !ok {
				continue
			}

			c.hub.Publish("pod.updated", updated)
			c.publishLog("delete", fmt.Sprintf("DELETE Pod/%s", updated.Name))
			if err := c.workers.Send(worker.TerminatePod{WorkerID: updated.WorkerID, PodID: updated.ID, Reason: "scale-down"}); err != nil {
				c.publishLog("error", fmt.Sprintf("failed to dispatch termination for %s: %v", updated.Name, err))
			}
		}
	default:
		c.publishLog("info", fmt.Sprintf("State converged: %d/%d replicas", len(running), desired))
	}

	c.setPhase(domain.PhaseSleep)
	c.setPhase(domain.PhaseIdle)
}

func (c *Controller) setPhase(phase domain.ReconcilePhase) {
	current := c.store.SetPhase(phase)
	c.hub.Publish("reconcile.phase", map[string]string{"phase": string(current)})
}

func (c *Controller) publishLog(logType, text string) {
	entry := c.store.AppendLog(logType, text)
	c.hub.Publish("log.append", entry)
}

func (c *Controller) nextWorkerID() string {
	workerIDs := c.workers.IDs()
	if len(workerIDs) == 0 {
		return ""
	}

	index := c.rrIndex.Add(1)
	return workerIDs[(index-1)%uint64(len(workerIDs))]
}
