package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/manuel/wesen/pod-deployment-demo/internal/events"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/catalog"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/runtime"
	scenarioserver "github.com/manuel/wesen/pod-deployment-demo/internal/scenario/server"
)

type App struct {
	httpServer *http.Server
}

func New() (*App, error) {
	cfg, err := LoadConfig()
	if err != nil {
		return nil, err
	}

	return NewWithConfig(cfg)
}

func NewWithConfig(cfg Config) (*App, error) {
	cat, err := catalog.Load(cfg.ScenariosDir)
	if err != nil {
		return nil, fmt.Errorf("load scenarios: %w", err)
	}
	if len(cat.Presets) == 0 {
		return nil, fmt.Errorf("no presets found in %s", cfg.ScenariosDir)
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
			Addr:              cfg.Addr,
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
