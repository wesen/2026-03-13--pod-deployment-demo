package server_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/manuel/wesen/pod-deployment-demo/internal/events"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/catalog"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/runtime"
	scenarioserver "github.com/manuel/wesen/pod-deployment-demo/internal/scenario/server"
)

func setup(t *testing.T) http.Handler {
	t.Helper()
	cat, err := catalog.Load("../../../scenarios")
	if err != nil {
		t.Fatalf("load catalog: %v", err)
	}

	hub := events.NewHub()
	first := cat.Presets[0]
	session, err := runtime.NewSession(&first, hub)
	if err != nil {
		t.Fatalf("new session: %v", err)
	}

	return scenarioserver.NewHandler(cat, session, hub)
}

func TestHealthz(t *testing.T) {
	h := setup(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/healthz", nil))

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestListPresets(t *testing.T) {
	h := setup(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/presets", nil))

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var presets []map[string]any
	if err := json.NewDecoder(w.Body).Decode(&presets); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(presets) != 2 {
		t.Errorf("expected 2 presets, got %d", len(presets))
	}
}

func TestGetSnapshot(t *testing.T) {
	h := setup(t)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/session/snapshot", nil))

	if w.Code != 200 {
		t.Fatalf("expected 200, got %d", w.Code)
	}

	var snap map[string]any
	if err := json.NewDecoder(w.Body).Decode(&snap); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if snap["tick"] != float64(0) {
		t.Errorf("expected tick 0, got %v", snap["tick"])
	}
}

func TestStepAndSnapshot(t *testing.T) {
	h := setup(t)

	// Step once.
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/session/step", nil))
	if w.Code != 200 {
		t.Fatalf("step: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Check snapshot.
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/session/snapshot", nil))

	var snap map[string]any
	_ = json.NewDecoder(w.Body).Decode(&snap)
	if snap["tick"] != float64(1) {
		t.Errorf("expected tick 1 after step, got %v", snap["tick"])
	}
}

func TestSwitchPreset(t *testing.T) {
	h := setup(t)

	body, _ := json.Marshal(map[string]string{"presetId": "taco-fleet"})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/session/preset", bytes.NewReader(body)))

	if w.Code != 200 {
		t.Fatalf("switch: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Verify snapshot reflects new preset.
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/session/snapshot", nil))

	var snap map[string]any
	_ = json.NewDecoder(w.Body).Decode(&snap)
	preset := snap["preset"].(map[string]any)
	if preset["id"] != "taco-fleet" {
		t.Errorf("expected taco-fleet after switch, got %v", preset["id"])
	}
}

func TestSpecGetPut(t *testing.T) {
	h := setup(t)

	// PUT new spec.
	body, _ := json.Marshal(map[string]any{"o2Percent": 30.0})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPut, "/api/session/spec", bytes.NewReader(body)))
	if w.Code != 200 {
		t.Fatalf("put spec: expected 200, got %d", w.Code)
	}

	// GET spec.
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/session/spec", nil))
	var spec map[string]any
	_ = json.NewDecoder(w.Body).Decode(&spec)
	if spec["o2Percent"] != 30.0 {
		t.Errorf("expected o2Percent 30, got %v", spec["o2Percent"])
	}
}

func TestReset(t *testing.T) {
	h := setup(t)

	// Step, then reset.
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/session/step", nil))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/session/reset", nil))
	if w.Code != 200 {
		t.Fatalf("reset: expected 200, got %d", w.Code)
	}

	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/session/snapshot", nil))
	var snap map[string]any
	_ = json.NewDecoder(w.Body).Decode(&snap)
	if snap["tick"] != float64(0) {
		t.Errorf("expected tick 0 after reset, got %v", snap["tick"])
	}
}
