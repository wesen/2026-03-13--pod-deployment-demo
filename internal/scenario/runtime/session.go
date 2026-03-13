package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/manuel/wesen/pod-deployment-demo/internal/events"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/model"
)

// Snapshot captures the state of a single tick for publication.
type Snapshot struct {
	Preset  model.Metadata  `json:"preset"`
	UI      []model.Control `json:"ui"`
	Tick    int             `json:"tick"`
	Phase   string          `json:"phase"`
	Desired map[string]any  `json:"desired"`
	Actual  map[string]any  `json:"actual"`
	Diff    map[string]any  `json:"diff"`
	Actions []any           `json:"actions"`
	Logs    []string        `json:"logs"`
	Running bool            `json:"running"`
	SpeedMs int             `json:"speedMs"`
}

// SessionState is the full JSON-friendly state returned by the snapshot API.
type SessionState struct {
	Snapshot
	AllLogs []string `json:"allLogs"`
}

// Session manages one active scenario runtime with a goja VM.
type Session struct {
	mu      sync.Mutex
	preset  *model.Preset
	vm      *VM
	hub     *events.Hub
	tick    int
	phase   string
	desired map[string]any
	last    Snapshot
	allLogs []string
	speedMs int
	running bool
	cancel  context.CancelFunc
}

// NewSession creates a session bound to the given preset.
func NewSession(preset *model.Preset, hub *events.Hub) (*Session, error) {
	vm, err := NewVM(preset)
	if err != nil {
		return nil, fmt.Errorf("create vm: %w", err)
	}

	speed := preset.Metadata.InitialTick
	if speed <= 0 {
		speed = 1000
	}

	// Deep-copy the preset spec as the initial desired state.
	desired := deepCopyMap(preset.Spec)

	s := &Session{
		preset:  preset,
		vm:      vm,
		hub:     hub,
		phase:   "idle",
		desired: desired,
		speedMs: speed,
	}
	s.last = s.buildSnapshot()
	return s, nil
}

// SwitchPreset stops the loop, builds a new VM, and resets all state.
func (s *Session) SwitchPreset(preset *model.Preset) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stopLocked()

	vm, err := NewVM(preset)
	if err != nil {
		return fmt.Errorf("create vm for %s: %w", preset.Metadata.ID, err)
	}

	speed := preset.Metadata.InitialTick
	if speed <= 0 {
		speed = 1000
	}

	s.preset = preset
	s.vm = vm
	s.tick = 0
	s.phase = "idle"
	s.desired = deepCopyMap(preset.Spec)
	s.allLogs = nil
	s.speedMs = speed
	s.last = s.buildSnapshot()

	s.publishStateLocked("preset.changed")
	s.publishStateLocked("snapshot.updated")
	return nil
}

// Run starts periodic ticking.
func (s *Session) Run() SessionState {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return s.currentStateLocked()
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	s.running = true
	s.last.Running = true

	go s.loop(ctx)
	s.publishStateLocked("session.state")
	s.publishStateLocked("snapshot.updated")
	return s.currentStateLocked()
}

// Pause stops periodic ticking.
func (s *Session) Pause() SessionState {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stopLocked()
	s.last.Running = false
	s.publishStateLocked("session.state")
	s.publishStateLocked("snapshot.updated")
	return s.currentStateLocked()
}

// Step runs exactly one tick.
func (s *Session) Step() (SessionState, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.tickLocked(); err != nil {
		return SessionState{}, err
	}

	return s.currentStateLocked(), nil
}

// Reset clears state without switching presets.
func (s *Session) Reset() SessionState {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.stopLocked()

	// Rebuild VM for clean state.
	vm, err := NewVM(s.preset)
	if err != nil {
		s.hub.Publish("runtime.error", map[string]any{"error": err.Error()})
		return s.currentStateLocked()
	}

	s.vm = vm
	s.tick = 0
	s.phase = "idle"
	s.desired = deepCopyMap(s.preset.Spec)
	s.allLogs = nil
	s.last = s.buildSnapshot()

	s.publishStateLocked("session.reset")
	s.publishStateLocked("snapshot.updated")
	return s.currentStateLocked()
}

// UpdateSpec replaces the desired spec.
func (s *Session) UpdateSpec(spec map[string]any) SessionState {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.desired = deepCopyMap(spec)
	s.last = s.buildSnapshot()
	s.publishStateLocked("snapshot.updated")
	return s.currentStateLocked()
}

// Spec returns the current desired spec.
func (s *Session) Spec() map[string]any {
	s.mu.Lock()
	defer s.mu.Unlock()
	return deepCopyMap(s.desired)
}

// CurrentSnapshot returns the last snapshot.
func (s *Session) CurrentSnapshot() SessionState {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.currentStateLocked()
}

// SetSpeed changes the tick interval in milliseconds.
func (s *Session) SetSpeed(ms int) SessionState {
	s.mu.Lock()
	defer s.mu.Unlock()
	if ms < 50 {
		ms = 50
	}
	s.speedMs = ms
	s.last.SpeedMs = ms
	s.publishStateLocked("snapshot.updated")
	return s.currentStateLocked()
}

// --- internal ---

func (s *Session) loop(ctx context.Context) {
	for {
		s.mu.Lock()
		speed := s.speedMs
		s.mu.Unlock()

		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Duration(speed) * time.Millisecond):
			s.mu.Lock()
			if err := s.tickLocked(); err != nil {
				s.hub.Publish("runtime.error", map[string]any{"error": err.Error()})
			}
			s.mu.Unlock()
		}
	}
}

func (s *Session) tickLocked() error {
	desired := deepCopyMap(s.desired)

	s.phase = "observe"
	actual, err := s.vm.RunObserve(desired)
	if err != nil {
		s.phase = "error"
		return fmt.Errorf("observe: %w", err)
	}

	s.phase = "compare"
	diff, err := s.vm.RunCompare(desired, actual)
	if err != nil {
		s.phase = "error"
		return fmt.Errorf("compare: %w", err)
	}

	s.phase = "plan"
	actions, err := s.vm.RunPlan(desired, actual, diff)
	if err != nil {
		s.phase = "error"
		return fmt.Errorf("plan: %w", err)
	}

	s.phase = "execute"
	if err := s.vm.RunExecute(desired, actual, diff, actions); err != nil {
		s.phase = "error"
		return fmt.Errorf("execute: %w", err)
	}

	logs := s.vm.FlushLogs()
	s.allLogs = append(s.allLogs, logs...)
	// Keep a bounded log history.
	if len(s.allLogs) > 500 {
		s.allLogs = s.allLogs[len(s.allLogs)-500:]
	}

	s.tick++
	s.phase = "idle"

	s.last = Snapshot{
		Preset:  s.preset.Metadata,
		UI:      append([]model.Control(nil), s.preset.UI...),
		Tick:    s.tick,
		Phase:   s.phase,
		Desired: desired,
		Actual:  actual,
		Diff:    diff,
		Actions: actions,
		Logs:    logs,
		Running: s.running,
		SpeedMs: s.speedMs,
	}

	s.publishStateLocked("snapshot.updated")
	return nil
}

func (s *Session) stopLocked() {
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}
	s.running = false
}

func (s *Session) buildSnapshot() Snapshot {
	return Snapshot{
		Preset:  s.preset.Metadata,
		UI:      append([]model.Control(nil), s.preset.UI...),
		Tick:    s.tick,
		Phase:   s.phase,
		Desired: deepCopyMap(s.desired),
		Actual:  map[string]any{},
		Diff:    map[string]any{},
		Actions: nil,
		Logs:    nil,
		Running: s.running,
		SpeedMs: s.speedMs,
	}
}

func (s *Session) currentStateLocked() SessionState {
	return SessionState{
		Snapshot: s.last,
		AllLogs:  append([]string(nil), s.allLogs...),
	}
}

func (s *Session) publishStateLocked(eventType string) {
	s.hub.Publish(eventType, s.currentStateLocked())
}

func deepCopyMap(m map[string]any) map[string]any {
	data, _ := json.Marshal(m)
	var out map[string]any
	_ = json.Unmarshal(data, &out)
	return out
}
