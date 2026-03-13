package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/manuel/wesen/pod-deployment-demo/internal/events"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/catalog"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/runtime"
	scenarioserver "github.com/manuel/wesen/pod-deployment-demo/internal/scenario/server"
)

const defaultAddr = ":3001"

type App struct {
	httpServer *http.Server
}

func New() (*App, error) {
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = defaultAddr
	}

	scenariosDir, err := resolveScenariosDir()
	if err != nil {
		return nil, err
	}

	cat, err := catalog.Load(scenariosDir)
	if err != nil {
		return nil, fmt.Errorf("load scenarios: %w", err)
	}
	if len(cat.Presets) == 0 {
		return nil, fmt.Errorf("no presets found in %s", scenariosDir)
	}

	hub := events.NewHub()
	first := cat.Presets[0]
	session, err := runtime.NewSession(&first, hub)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}

	handler := scenarioserver.NewHandler(cat, session, hub)

	return &App{
		httpServer: &http.Server{
			Addr:              addr,
			Handler:           handler,
			ReadHeaderTimeout: 5 * time.Second,
		},
	}, nil
}

func (a *App) Run(ctx context.Context) error {
	serverErrors := make(chan error, 1)

	go func() {
		serverErrors <- a.httpServer.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := a.httpServer.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown server: %w", err)
		}

		return nil
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}

		return fmt.Errorf("run http server: %w", err)
	}
}

func resolveScenariosDir() (string, error) {
	if dir := os.Getenv("SCENARIOS_DIR"); dir != "" {
		return dir, nil
	}

	root, err := findRepoRoot()
	if err != nil {
		return "", err
	}

	return filepath.Join(root, "scenarios"), nil
}

func findRepoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}

		next := filepath.Dir(dir)
		if next == dir {
			return "", fmt.Errorf("repo root with go.mod not found")
		}

		dir = next
	}
}
