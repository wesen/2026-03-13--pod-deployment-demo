package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/manuel/wesen/pod-deployment-demo/internal/events"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/catalog"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/runtime"
	scenarioserver "github.com/manuel/wesen/pod-deployment-demo/internal/scenario/server"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	scenariosDir := "scenarios"
	if dir := os.Getenv("SCENARIOS_DIR"); dir != "" {
		scenariosDir = dir
	}

	addr := ":3002"
	if a := os.Getenv("ADDR"); a != "" {
		addr = a
	}

	cat, err := catalog.Load(scenariosDir)
	if err != nil {
		return fmt.Errorf("load scenarios from %s: %w", scenariosDir, err)
	}
	if len(cat.Presets) == 0 {
		return fmt.Errorf("no presets found in %s", scenariosDir)
	}

	log.Printf("loaded %d scenario preset(s): ", len(cat.Presets))
	for _, p := range cat.Presets {
		log.Printf("  %s %s – %s", p.Metadata.Icon, p.Metadata.ID, p.Metadata.Name)
	}

	hub := events.NewHub()

	first := cat.Presets[0]
	session, err := runtime.NewSession(&first, hub)
	if err != nil {
		return fmt.Errorf("init session with %s: %w", first.Metadata.ID, err)
	}
	log.Printf("active preset: %s %s", first.Metadata.Icon, first.Metadata.ID)

	handler := scenarioserver.NewHandler(cat, session, hub)
	srv := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	serverErrors := make(chan error, 1)
	go func() {
		log.Printf("scenario-demo listening on %s", addr)
		serverErrors <- srv.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown: %w", err)
		}
		return nil
	case err := <-serverErrors:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("http server: %w", err)
	}
}
