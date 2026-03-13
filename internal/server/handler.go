package server

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"

	"github.com/manuel/wesen/pod-deployment-demo/internal/system"
	"github.com/manuel/wesen/pod-deployment-demo/internal/web"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Server struct {
	service *system.Service
}

type healthResponse struct {
	Status string `json:"status"`
}

type replicasRequest struct {
	Replicas int `json:"replicas"`
}

type chaosRequest struct {
	Enabled bool `json:"enabled"`
}

func NewHandler(service *system.Service) http.Handler {
	mux := http.NewServeMux()
	server := &Server{service: service}
	spaHandler := web.NewSPAHandler()

	mux.HandleFunc("/api/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}

		writeJSON(w, http.StatusOK, healthResponse{Status: "ok"})
	})

	mux.HandleFunc("/api/snapshot", server.handleSnapshot)
	mux.HandleFunc("/api/deployments/web", server.handleDeployment)
	mux.HandleFunc("/api/chaos/toggle", server.handleChaos)
	mux.HandleFunc("/api/pods/", server.handlePodKill)
	mux.HandleFunc("/ws", server.handleWebSocket)
	mux.Handle("/", spaHandler)

	return mux
}

func (s *Server) handleSnapshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	writeJSON(w, http.StatusOK, s.service.Snapshot())
}

func (s *Server) handleDeployment(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req replicasRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	deployment, err := s.service.UpdateReplicas(req.Replicas)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":         true,
		"deployment": deployment,
	})
}

func (s *Server) handleChaos(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	var req chaosRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	enabled := s.service.SetChaos(req.Enabled)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":      true,
		"enabled": enabled,
	})
}

func (s *Server) handlePodKill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	if !strings.HasSuffix(r.URL.Path, "/kill") {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	podID := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/pods/"), "/kill")
	podID = strings.Trim(podID, "/")
	if podID == "" {
		writeError(w, http.StatusBadRequest, "missing pod id")
		return
	}

	if err := s.service.KillPod(podID, "Manual kill"); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusAccepted, map[string]interface{}{
		"ok":    true,
		"podId": podID,
	})
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	if err := conn.WriteJSON(map[string]interface{}{
		"type":    "snapshot",
		"ts":      "",
		"payload": s.service.Snapshot(),
	}); err != nil {
		return
	}

	events, unsubscribe := s.service.Subscribe()
	defer unsubscribe()

	for event := range events {
		if err := conn.WriteJSON(event); err != nil {
			return
		}
	}
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, statusCode int, message string) {
	writeJSON(w, statusCode, map[string]string{"error": message})
}

func decodeJSON(r *http.Request, target interface{}) error {
	if r.Body == nil {
		return errors.New("request body required")
	}

	defer r.Body.Close()
	if err := json.NewDecoder(r.Body).Decode(target); err != nil {
		return err
	}

	return nil
}
