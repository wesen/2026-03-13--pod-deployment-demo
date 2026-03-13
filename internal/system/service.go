package system

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/manuel/wesen/pod-deployment-demo/internal/controller"
	"github.com/manuel/wesen/pod-deployment-demo/internal/domain"
	"github.com/manuel/wesen/pod-deployment-demo/internal/events"
	"github.com/manuel/wesen/pod-deployment-demo/internal/state"
	"github.com/manuel/wesen/pod-deployment-demo/internal/worker"
)

type Service struct {
	store      *state.Store
	hub        *events.Hub
	workers    *worker.Manager
	controller *controller.Controller
}

func New() *Service {
	workerIDs := []string{"worker-a", "worker-b", "worker-c"}
	store := state.New(workerIDs)
	hub := events.NewHub()
	workers := worker.NewManager(workerIDs)
	ctrl := controller.New(store, hub, workers)

	return &Service{
		store:      store,
		hub:        hub,
		workers:    workers,
		controller: ctrl,
	}
}

func (s *Service) Start(ctx context.Context) {
	s.workers.Start(ctx)
	go s.consumeWorkerEvents(ctx)
	go s.controller.Start(ctx)
	go s.runChaosLoop(ctx)
}

func (s *Service) Snapshot() domain.Snapshot {
	return s.store.Snapshot()
}

func (s *Service) Subscribe() (<-chan domain.Event, func()) {
	return s.hub.Subscribe()
}

func (s *Service) UpdateReplicas(replicas int) (domain.DeploymentSpec, error) {
	if replicas < 0 || replicas > 12 {
		return domain.DeploymentSpec{}, fmt.Errorf("replicas must be between 0 and 12")
	}

	deployment := s.store.UpdateDeploymentReplicas(replicas)
	s.publishLog("watch", fmt.Sprintf("Deployment/%s scaled to %d replicas", deployment.Name, deployment.Replicas))
	s.hub.Publish("deployment.updated", deployment)
	s.controller.Trigger("deployment updated")
	return deployment, nil
}

func (s *Service) SetChaos(enabled bool) bool {
	current := s.store.SetChaos(enabled)
	s.publishLog("watch", fmt.Sprintf("Chaos mode set to %t", current))
	s.hub.Publish("chaos.updated", map[string]bool{"enabled": current})
	return current
}

func (s *Service) KillPod(podID string, reason string) error {
	pod, ok := s.store.MarkPodTerminating(podID)
	if !ok {
		return fmt.Errorf("running pod %q not found", podID)
	}

	s.hub.Publish("pod.updated", pod)
	s.publishLog("delete", fmt.Sprintf("%s: Pod/%s", strings.TrimSpace(reason), pod.Name))
	return s.workers.Send(worker.TerminatePod{WorkerID: pod.WorkerID, PodID: pod.ID, Reason: reason})
}

func (s *Service) consumeWorkerEvents(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case event := <-s.workers.Events():
			switch evt := event.(type) {
			case worker.PodRunning:
				pod, ok := s.store.MarkPodRunning(evt.PodID)
				if !ok {
					continue
				}
				s.hub.Publish("pod.updated", pod)
				s.publishLog("create", fmt.Sprintf("Pod/%s is now running on %s", pod.Name, pod.WorkerID))
			case worker.PodDeleted:
				pod, ok := s.store.DeletePod(evt.PodID)
				if !ok {
					continue
				}
				s.hub.Publish("pod.deleted", pod)
				s.publishLog("delete", fmt.Sprintf("Pod/%s removed (%s)", pod.Name, evt.Reason))
				s.controller.Trigger("worker reported pod deletion")
			case worker.WorkerHeartbeat:
				s.hub.Publish("worker.heartbeat", map[string]string{
					"workerId": evt.WorkerID,
					"at":       evt.At.Format(time.RFC3339),
				})
			}
		}
	}
}

func (s *Service) runChaosLoop(ctx context.Context) {
	ticker := time.NewTicker(6 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if !s.store.ChaosEnabled() {
				continue
			}

			pod, ok := s.store.RandomRunningPod()
			if !ok {
				continue
			}

			if err := s.KillPod(pod.ID, "CHAOS"); err == nil {
				s.hub.Publish("chaos.injected", map[string]string{
					"podId": pod.ID,
					"name":  pod.Name,
				})
			}
		}
	}
}

func (s *Service) publishLog(logType, text string) {
	entry := s.store.AppendLog(logType, text)
	s.hub.Publish("log.append", entry)
}
