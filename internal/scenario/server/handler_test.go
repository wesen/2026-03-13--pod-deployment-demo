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
	if len(presets) != 3 {
		t.Errorf("expected 3 presets, got %d", len(presets))
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
	if _, ok := snap["ui"]; !ok {
		t.Fatalf("expected ui schema in session snapshot")
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

	var stepResponse struct {
		OK       bool           `json:"ok"`
		Snapshot map[string]any `json:"snapshot"`
	}
	if err := json.NewDecoder(w.Body).Decode(&stepResponse); err != nil {
		t.Fatalf("decode step response: %v", err)
	}
	if stepResponse.Snapshot["tick"] != float64(1) {
		t.Fatalf("expected returned snapshot tick 1, got %v", stepResponse.Snapshot["tick"])
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

	var switchResponse struct {
		OK       bool           `json:"ok"`
		Snapshot map[string]any `json:"snapshot"`
	}
	if err := json.NewDecoder(w.Body).Decode(&switchResponse); err != nil {
		t.Fatalf("decode switch response: %v", err)
	}
	presetSnapshot := switchResponse.Snapshot["preset"].(map[string]any)
	if presetSnapshot["id"] != "taco-fleet" {
		t.Fatalf("expected taco-fleet in returned snapshot, got %v", presetSnapshot["id"])
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

	var putResponse struct {
		OK       bool           `json:"ok"`
		Snapshot map[string]any `json:"snapshot"`
	}
	if err := json.NewDecoder(w.Body).Decode(&putResponse); err != nil {
		t.Fatalf("decode put response: %v", err)
	}
	desired := putResponse.Snapshot["desired"].(map[string]any)
	if desired["o2Percent"] != 30.0 {
		t.Fatalf("expected returned desired o2Percent 30, got %v", desired["o2Percent"])
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

	var resetResponse struct {
		OK       bool           `json:"ok"`
		Snapshot map[string]any `json:"snapshot"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resetResponse); err != nil {
		t.Fatalf("decode reset response: %v", err)
	}
	if resetResponse.Snapshot["tick"] != float64(0) {
		t.Fatalf("expected returned tick 0 after reset, got %v", resetResponse.Snapshot["tick"])
	}

	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/session/snapshot", nil))
	var snap map[string]any
	_ = json.NewDecoder(w.Body).Decode(&snap)
	if snap["tick"] != float64(0) {
		t.Errorf("expected tick 0 after reset, got %v", snap["tick"])
	}
}

func TestSpeedReturnsUpdatedSnapshot(t *testing.T) {
	h := setup(t)

	body, _ := json.Marshal(map[string]any{"speedMs": 275})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/session/speed", bytes.NewReader(body)))
	if w.Code != 200 {
		t.Fatalf("speed: expected 200, got %d", w.Code)
	}

	var response struct {
		OK       bool           `json:"ok"`
		Snapshot map[string]any `json:"snapshot"`
	}
	if err := json.NewDecoder(w.Body).Decode(&response); err != nil {
		t.Fatalf("decode speed response: %v", err)
	}
	if response.Snapshot["speedMs"] != float64(275) {
		t.Fatalf("expected returned speed 275, got %v", response.Snapshot["speedMs"])
	}
}
