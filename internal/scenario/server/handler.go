package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"

	"github.com/manuel/wesen/pod-deployment-demo/internal/events"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/catalog"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/runtime"
	"github.com/manuel/wesen/pod-deployment-demo/internal/web"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Handler serves the scenario runtime HTTP and WebSocket API.
type Handler struct {
	catalog *catalog.Catalog
	session *runtime.Session
	hub     *events.Hub
}

// NewHandler wires all routes for the scenario runtime.
func NewHandler(cat *catalog.Catalog, session *runtime.Session, hub *events.Hub) http.Handler {
	h := &Handler{catalog: cat, session: session, hub: hub}
	mux := http.NewServeMux()
	spa := web.NewSPAHandler()

	mux.HandleFunc("/api/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("/api/presets", h.handlePresets)
	mux.HandleFunc("/api/presets/", h.handlePresetDetail)
	mux.HandleFunc("/api/session/preset", h.handleSwitchPreset)
	mux.HandleFunc("/api/session/run", h.handleRun)
	mux.HandleFunc("/api/session/pause", h.handlePause)
	mux.HandleFunc("/api/session/step", h.handleStep)
	mux.HandleFunc("/api/session/reset", h.handleReset)
	mux.HandleFunc("/api/session/spec", h.handleSpec)
	mux.HandleFunc("/api/session/speed", h.handleSpeed)
	mux.HandleFunc("/api/session/snapshot", h.handleSnapshot)
	mux.HandleFunc("/ws", h.handleWebSocket)
	mux.Handle("/", spa)

	return mux
}

func (h *Handler) handlePresets(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	type presetInfo struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Icon        string `json:"icon"`
		Description string `json:"description"`
	}

	out := make([]presetInfo, 0, len(h.catalog.Presets))
	for _, p := range h.catalog.Presets {
		out = append(out, presetInfo{
			ID:          p.Metadata.ID,
			Name:        p.Metadata.Name,
			Icon:        p.Metadata.Icon,
			Description: p.Metadata.Description,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) handlePresetDetail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	// Parse /api/presets/{id}/ui
	path := r.URL.Path
	// Strip prefix to get "{id}/ui"
	rest := strings.TrimPrefix(path, "/api/presets/")
	parts := strings.SplitN(rest, "/", 2)
	if len(parts) != 2 || parts[1] != "ui" {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	preset, ok := h.catalog.ByID(parts[0])
	if !ok {
		writeError(w, http.StatusNotFound, "preset not found: "+parts[0])
		return
	}

	writeJSON(w, http.StatusOK, preset.UI)
}

func (h *Handler) handleSwitchPreset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req struct {
		PresetID string `json:"presetId"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	preset, ok := h.catalog.ByID(req.PresetID)
	if !ok {
		writeError(w, http.StatusNotFound, "preset not found: "+req.PresetID)
		return
	}

	if err := h.session.SwitchPreset(&preset); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	snapshot := h.session.CurrentSnapshot()
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"presetId":    req.PresetID,
		"vmRestarted": true,
		"snapshot":    snapshot,
	})
}

func (h *Handler) handleRun(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	snapshot := h.session.Run()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "snapshot": snapshot})
}

func (h *Handler) handlePause(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	snapshot := h.session.Pause()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "snapshot": snapshot})
}

func (h *Handler) handleStep(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	snapshot, err := h.session.Step()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "snapshot": snapshot})
}

func (h *Handler) handleReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	snapshot := h.session.Reset()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "snapshot": snapshot})
}

func (h *Handler) handleSpec(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, h.session.Spec())
	case http.MethodPut:
		var spec map[string]any
		if err := decodeJSON(r, &spec); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		snapshot := h.session.UpdateSpec(spec)
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "snapshot": snapshot})
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) handleSpeed(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var req struct {
		SpeedMs int `json:"speedMs"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	snapshot := h.session.SetSpeed(req.SpeedMs)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "snapshot": snapshot})
}

func (h *Handler) handleSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, h.session.CurrentSnapshot())
}

func (h *Handler) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	// Send initial snapshot.
	snap := h.session.CurrentSnapshot()
	if err := conn.WriteJSON(map[string]any{
		"type":    "snapshot",
		"ts":      "",
		"payload": snap,
	}); err != nil {
		return
	}

	events, unsubscribe := h.hub.Subscribe()
	defer unsubscribe()

	for event := range events {
		if err := conn.WriteJSON(event); err != nil {
			return
		}
	}
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, code int, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		http.Error(w, fmt.Sprintf("encode json: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(append(data, '\n'))
}

func writeError(w http.ResponseWriter, code int, message string) {
	writeJSON(w, code, map[string]string{"error": message})
}

func decodeJSON(r *http.Request, target any) error {
	if r.Body == nil {
		return errors.New("request body required")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(target)
}
