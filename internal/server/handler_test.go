package server

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/manuel/wesen/pod-deployment-demo/internal/system"
)

func TestHealthz(t *testing.T) {
	t.Parallel()

	service := system.New()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	service.Start(ctx)

	req := httptest.NewRequest(http.MethodGet, "/api/healthz", nil)
	rec := httptest.NewRecorder()

	NewHandler(service).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	expected := "{\"status\":\"ok\"}\n"
	if rec.Body.String() != expected {
		t.Fatalf("expected body %q, got %q", expected, rec.Body.String())
	}
}

func TestSnapshot(t *testing.T) {
	t.Parallel()

	service := system.New()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	service.Start(ctx)

	req := httptest.NewRequest(http.MethodGet, "/api/snapshot", nil)
	rec := httptest.NewRecorder()

	NewHandler(service).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	var snapshot struct {
		Deployment struct {
			Replicas int `json:"replicas"`
		} `json:"deployment"`
		Pods []struct{} `json:"pods"`
	}

	if err := json.Unmarshal(rec.Body.Bytes(), &snapshot); err != nil {
		t.Fatalf("unmarshal snapshot: %v", err)
	}

	if snapshot.Deployment.Replicas != 3 {
		t.Fatalf("expected replicas 3, got %d", snapshot.Deployment.Replicas)
	}

	if len(snapshot.Pods) != 3 {
		t.Fatalf("expected 3 pods, got %d", len(snapshot.Pods))
	}
}

func TestScaleEndpointTriggersReconcile(t *testing.T) {
	t.Parallel()

	service := system.New()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	service.Start(ctx)

	req := httptest.NewRequest(http.MethodPatch, "/api/deployments/web", strings.NewReader(`{"replicas":4}`))
	rec := httptest.NewRecorder()

	NewHandler(service).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if len(service.Snapshot().Pods) >= 4 {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}

	t.Fatalf("expected a fourth pod to be created, got %d", len(service.Snapshot().Pods))
}
