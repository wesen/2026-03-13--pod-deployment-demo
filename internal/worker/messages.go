package worker

import "time"

type SpawnPod struct {
	WorkerID string
	PodID    string
}

type TerminatePod struct {
	WorkerID string
	PodID    string
	Reason   string
}

type WorkerCommand interface {
	workerCommand()
}

func (SpawnPod) workerCommand()     {}
func (TerminatePod) workerCommand() {}

type PodRunning struct {
	WorkerID string
	PodID    string
}

type PodDeleted struct {
	WorkerID string
	PodID    string
	Reason   string
}

type WorkerHeartbeat struct {
	WorkerID string
	At       time.Time
}

type WorkerEvent interface {
	workerEvent()
}

func (PodRunning) workerEvent()      {}
func (PodDeleted) workerEvent()      {}
func (WorkerHeartbeat) workerEvent() {}
