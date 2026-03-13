package runtime_test

import (
	"testing"

	"github.com/manuel/wesen/pod-deployment-demo/internal/events"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/catalog"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/runtime"
)

func loadCatalog(t *testing.T) *catalog.Catalog {
	t.Helper()
	cat, err := catalog.Load("../../../scenarios")
	if err != nil {
		t.Fatalf("load catalog: %v", err)
	}
	return cat
}

func TestSession_SpaceStation_Step(t *testing.T) {
	cat := loadCatalog(t)
	preset, ok := cat.ByID("space-station")
	if !ok {
		t.Fatal("preset space-station not found")
	}

	hub := events.NewHub()
	sess, err := runtime.NewSession(&preset, hub)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	// Run 5 ticks and verify snapshots advance.
	for i := 0; i < 5; i++ {
		if _, err := sess.Step(); err != nil {
			t.Fatalf("step %d: %v", i+1, err)
		}
	}

	snap := sess.CurrentSnapshot()
	if snap.Tick != 5 {
		t.Errorf("expected tick 5, got %d", snap.Tick)
	}
	if snap.Phase != "idle" {
		t.Errorf("expected phase idle, got %s", snap.Phase)
	}
	if snap.Preset.ID != "space-station" {
		t.Errorf("expected preset space-station, got %s", snap.Preset.ID)
	}
	if len(snap.Actual) == 0 {
		t.Error("expected non-empty actual after 5 ticks")
	}
	if len(snap.UI) == 0 {
		t.Error("expected active UI schema in snapshot")
	}
}

func TestSession_TacoFleet_Step(t *testing.T) {
	cat := loadCatalog(t)
	preset, ok := cat.ByID("taco-fleet")
	if !ok {
		t.Fatal("preset taco-fleet not found")
	}

	hub := events.NewHub()
	sess, err := runtime.NewSession(&preset, hub)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	for i := 0; i < 3; i++ {
		if _, err := sess.Step(); err != nil {
			t.Fatalf("step %d: %v", i+1, err)
		}
	}

	snap := sess.CurrentSnapshot()
	if snap.Tick != 3 {
		t.Errorf("expected tick 3, got %d", snap.Tick)
	}
	if len(snap.Actual) == 0 {
		t.Error("expected non-empty actual after 3 ticks")
	}
}

func TestSession_TacoFleet_DispatchesTruckTowardDesiredCount(t *testing.T) {
	cat := loadCatalog(t)
	preset, ok := cat.ByID("taco-fleet")
	if !ok {
		t.Fatal("preset taco-fleet not found")
	}

	hub := events.NewHub()
	sess, err := runtime.NewSession(&preset, hub)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	state := sess.UpdateSpec(map[string]any{
		"trucks":           4.0,
		"salsaPolicy":      "generous",
		"demandMultiplier": 1.5,
		"lunchRush":        false,
		"hotZone":          "campus",
	})

	if state.Desired["trucks"] != 4.0 {
		t.Fatalf("expected desired truck count 4, got %v", state.Desired["trucks"])
	}

	first, err := sess.Step()
	if err != nil {
		t.Fatalf("first step: %v", err)
	}
	trucksTickOne, ok := first.Actual["trucks"].([]any)
	if !ok {
		t.Fatalf("expected trucks array in actual snapshot, got %#v", first.Actual["trucks"])
	}
	if len(trucksTickOne) != 2 {
		t.Fatalf("expected first tick to still observe 2 trucks before dispatch completes, got %d", len(trucksTickOne))
	}
	if len(first.Actions) == 0 {
		t.Fatalf("expected dispatch action on first tick")
	}

	second, err := sess.Step()
	if err != nil {
		t.Fatalf("second step: %v", err)
	}
	trucksTickTwo, ok := second.Actual["trucks"].([]any)
	if !ok {
		t.Fatalf("expected trucks array in second snapshot, got %#v", second.Actual["trucks"])
	}
	if len(trucksTickTwo) != 3 {
		t.Fatalf("expected dispatched truck by second tick, got %d trucks", len(trucksTickTwo))
	}
}

func TestSession_ZombieFleet_Step(t *testing.T) {
	cat := loadCatalog(t)
	preset, ok := cat.ByID("zombie-fleet")
	if !ok {
		t.Fatal("preset zombie-fleet not found")
	}

	hub := events.NewHub()
	sess, err := runtime.NewSession(&preset, hub)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	snap, err := sess.Step()
	if err != nil {
		t.Fatalf("step: %v", err)
	}

	if snap.Preset.ID != "zombie-fleet" {
		t.Fatalf("expected zombie-fleet preset, got %s", snap.Preset.ID)
	}
	if len(snap.Actual) == 0 {
		t.Fatal("expected non-empty actual state")
	}
	if _, ok := snap.Actual["nearby"]; !ok {
		t.Fatalf("expected nearby field in actual state")
	}
}

func TestSession_PresetSwitch(t *testing.T) {
	cat := loadCatalog(t)
	space, _ := cat.ByID("space-station")
	taco, _ := cat.ByID("taco-fleet")

	hub := events.NewHub()
	sess, err := runtime.NewSession(&space, hub)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	// Tick a few times.
	for i := 0; i < 3; i++ {
		_, _ = sess.Step()
	}
	if sess.CurrentSnapshot().Tick != 3 {
		t.Fatal("expected 3 ticks before switch")
	}

	// Switch preset.
	if err := sess.SwitchPreset(&taco); err != nil {
		t.Fatalf("switch preset: %v", err)
	}

	snap := sess.CurrentSnapshot()
	if snap.Tick != 0 {
		t.Errorf("expected tick reset to 0 after switch, got %d", snap.Tick)
	}
	if snap.Preset.ID != "taco-fleet" {
		t.Errorf("expected preset taco-fleet after switch, got %s", snap.Preset.ID)
	}

	// Verify ticking works on new preset.
	if _, err := sess.Step(); err != nil {
		t.Fatalf("step after switch: %v", err)
	}
	if sess.CurrentSnapshot().Tick != 1 {
		t.Error("expected tick 1 after step on new preset")
	}
}

func TestSession_Reset(t *testing.T) {
	cat := loadCatalog(t)
	preset, _ := cat.ByID("space-station")

	hub := events.NewHub()
	sess, err := runtime.NewSession(&preset, hub)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	_, _ = sess.Step()
	_, _ = sess.Step()
	sess.Reset()

	snap := sess.CurrentSnapshot()
	if snap.Tick != 0 {
		t.Errorf("expected tick 0 after reset, got %d", snap.Tick)
	}
	if snap.Preset.ID != "space-station" {
		t.Errorf("expected same preset after reset")
	}
}

func TestSession_SpecUpdate(t *testing.T) {
	cat := loadCatalog(t)
	preset, _ := cat.ByID("space-station")

	hub := events.NewHub()
	sess, err := runtime.NewSession(&preset, hub)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	state := sess.UpdateSpec(map[string]any{
		"o2Percent": 25.0,
		"co2Ppm":    500.0,
	})

	spec := sess.Spec()
	if spec["o2Percent"] != 25.0 {
		t.Errorf("expected o2Percent 25, got %v", spec["o2Percent"])
	}
	if state.Desired["o2Percent"] != 25.0 {
		t.Errorf("expected snapshot desired o2Percent 25, got %v", state.Desired["o2Percent"])
	}
}

func TestSession_SetSpeedPublishesSnapshotState(t *testing.T) {
	cat := loadCatalog(t)
	preset, _ := cat.ByID("space-station")

	hub := events.NewHub()
	sess, err := runtime.NewSession(&preset, hub)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	state := sess.SetSpeed(450)
	if state.SpeedMs != 450 {
		t.Fatalf("expected speed 450, got %d", state.SpeedMs)
	}
}

func TestSession_EventsPublished(t *testing.T) {
	cat := loadCatalog(t)
	preset, _ := cat.ByID("space-station")

	hub := events.NewHub()
	ch, unsub := hub.Subscribe()
	defer unsub()

	sess, err := runtime.NewSession(&preset, hub)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	_, _ = sess.Step()

	// Drain to find snapshot.updated event.
	found := false
	for i := 0; i < 10; i++ {
		select {
		case ev := <-ch:
			if ev.Type == "snapshot.updated" {
				found = true
			}
		default:
		}
	}
	if !found {
		t.Error("expected snapshot.updated event after step")
	}
}
