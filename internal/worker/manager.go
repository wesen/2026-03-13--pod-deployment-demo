package worker

import (
	"context"
	"fmt"
	"slices"
)

type Manager struct {
	workers map[string]*runtimeWorker
	events  chan WorkerEvent
}

func NewManager(workerIDs []string) *Manager {
	events := make(chan WorkerEvent, 64)
	workers := make(map[string]*runtimeWorker, len(workerIDs))

	for _, id := range workerIDs {
		workers[id] = newRuntimeWorker(id, events)
	}

	return &Manager{
		workers: workers,
		events:  events,
	}
}

func (m *Manager) Start(ctx context.Context) {
	for _, runtime := range m.workers {
		go runtime.run(ctx)
	}
}

func (m *Manager) Events() <-chan WorkerEvent {
	return m.events
}

func (m *Manager) IDs() []string {
	ids := make([]string, 0, len(m.workers))
	for id := range m.workers {
		ids = append(ids, id)
	}

	slices.Sort(ids)
	return ids
}

func (m *Manager) Send(command WorkerCommand) error {
	var workerID string
	switch cmd := command.(type) {
	case SpawnPod:
		workerID = cmd.WorkerID
	case TerminatePod:
		workerID = cmd.WorkerID
	default:
		return fmt.Errorf("unsupported worker command %T", command)
	}

	runtime, ok := m.workers[workerID]
	if !ok {
		return fmt.Errorf("unknown worker %q", workerID)
	}

	runtime.commands <- command
	return nil
}
