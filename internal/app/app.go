package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/manuel/wesen/pod-deployment-demo/internal/server"
)

const defaultAddr = ":3001"

type App struct {
	httpServer *http.Server
}

func New() *App {
	handler := server.NewHandler()

	return &App{
		httpServer: &http.Server{
			Addr:              defaultAddr,
			Handler:           handler,
			ReadHeaderTimeout: 5 * time.Second,
		},
	}
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
