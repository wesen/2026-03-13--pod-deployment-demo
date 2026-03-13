package app

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewBuildsScenarioRuntimeApp(t *testing.T) {
	t.Setenv("ADDR", ":3017")

	application, err := New()
	if err != nil {
		t.Fatalf("new app: %v", err)
	}

	if application.httpServer.Addr != ":3017" {
		t.Fatalf("expected addr :3017, got %s", application.httpServer.Addr)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/session/snapshot", nil)
	rec := httptest.NewRecorder()
	application.httpServer.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected scenario snapshot endpoint to respond 200, got %d", rec.Code)
	}
}
