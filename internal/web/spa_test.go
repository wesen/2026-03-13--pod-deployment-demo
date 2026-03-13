package web

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

func TestSPAHandlerFallsBackToIndex(t *testing.T) {
	t.Parallel()

	handler := NewSPAHandlerFS(fstest.MapFS{
		"index.html": {Data: []byte("<html><body>ok</body></html>")},
	})

	req := httptest.NewRequest(http.MethodGet, "/demo/route", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rec.Code)
	}

	if got := rec.Header().Get("Content-Type"); got != "text/html; charset=utf-8" {
		t.Fatalf("expected html content type, got %q", got)
	}
}
