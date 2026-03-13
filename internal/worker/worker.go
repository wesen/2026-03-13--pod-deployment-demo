package worker

import (
	"context"
	"time"
)

type runtimeWorker struct {
	id       string
	commands chan WorkerCommand
	events   chan<- WorkerEvent
}

func newRuntimeWorker(id string, events chan<- WorkerEvent) *runtimeWorker {
	return &runtimeWorker{
		id:       id,
		commands: make(chan WorkerCommand, 16),
		events:   events,
	}
}

func (w *runtimeWorker) run(ctx context.Context) {
	heartbeatTicker := time.NewTicker(10 * time.Second)
	defer heartbeatTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-heartbeatTicker.C:
			w.emit(ctx, WorkerHeartbeat{WorkerID: w.id, At: time.Now().UTC()})
		case command := <-w.commands:
			switch cmd := command.(type) {
			case SpawnPod:
				timer := time.NewTimer(850 * time.Millisecond)
				select {
				case <-ctx.Done():
					timer.Stop()
					return
				case <-timer.C:
					w.emit(ctx, PodRunning{WorkerID: w.id, PodID: cmd.PodID})
				}
			case TerminatePod:
				timer := time.NewTimer(450 * time.Millisecond)
				select {
				case <-ctx.Done():
					timer.Stop()
					return
				case <-timer.C:
					w.emit(ctx, PodDeleted{WorkerID: w.id, PodID: cmd.PodID, Reason: cmd.Reason})
				}
			}
		}
	}
}

func (w *runtimeWorker) emit(ctx context.Context, event WorkerEvent) {
	select {
	case <-ctx.Done():
	case w.events <- event:
	}
}
