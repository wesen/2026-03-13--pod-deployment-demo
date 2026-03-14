package web

import (
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
)

func NewSPAHandler() http.Handler {
	return NewSPAHandlerFS(publicFS())
}

func NewSPAHandlerFS(staticFS fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "." || name == "" {
			name = "index.html"
		}

		if !serveFile(w, staticFS, name) {
			if !serveFile(w, staticFS, "index.html") {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusServiceUnavailable)
				_, _ = w.Write([]byte("<!doctype html><html><body><h1>frontend assets missing</h1><p>Run go generate ./internal/web or pnpm --dir ui run build.</p></body></html>"))
			}
		}
	})
}

func serveFile(w http.ResponseWriter, staticFS fs.FS, name string) bool {
	data, err := fs.ReadFile(staticFS, name)
	if err != nil {
		return false
	}

	contentType := mime.TypeByExtension(path.Ext(name))
	if contentType == "" {
		contentType = http.DetectContentType(data)
	}

	w.Header().Set("Content-Type", contentType)
	_, _ = w.Write(data)
	return true
}
