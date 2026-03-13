package cli

import (
	"context"
	"fmt"

	"github.com/go-go-golems/glazed/pkg/help"
	helpcmd "github.com/go-go-golems/glazed/pkg/help/cmd"
	"github.com/spf13/cobra"

	"github.com/manuel/wesen/pod-deployment-demo/internal/app"
	"github.com/manuel/wesen/pod-deployment-demo/internal/doc"
)

func NewRootCommand() (*cobra.Command, error) {
	helpSystem := help.NewHelpSystem()
	if err := doc.AddDocToHelpSystem(helpSystem); err != nil {
		return nil, fmt.Errorf("load embedded docs: %w", err)
	}

	var addr string
	var scenariosDir string

	serveRunE := func(cmd *cobra.Command, _ []string) error {
		cfg, err := app.LoadConfig()
		if err != nil {
			return err
		}

		if cmd.Flags().Changed("addr") {
			cfg.Addr = addr
		}
		if cmd.Flags().Changed("scenarios-dir") {
			cfg.ScenariosDir = scenariosDir
		}

		application, err := app.NewWithConfig(cfg)
		if err != nil {
			return err
		}

		return application.Run(cmd.Context())
	}

	rootCmd := &cobra.Command{
		Use:   "scenario-demo",
		Short: "Serve the pod deployment scenario workbench and runtime APIs.",
		Long:  "scenario-demo runs the pod deployment demo server and exposes embedded operational documentation through the help system.",
		RunE:  serveRunE,
	}

	rootCmd.PersistentFlags().StringVar(&addr, "addr", "", "Listen address for the HTTP server")
	rootCmd.PersistentFlags().StringVar(&scenariosDir, "scenarios-dir", "", "Directory containing scenario preset folders")

	rootCmd.AddCommand(&cobra.Command{
		Use:   "serve",
		Short: "Start the HTTP server and scenario runtime",
		RunE:  serveRunE,
	})

	helpcmd.SetupCobraRootCommand(helpSystem, rootCmd)

	return rootCmd, nil
}

func Execute(ctx context.Context) error {
	rootCmd, err := NewRootCommand()
	if err != nil {
		return err
	}

	rootCmd.SetContext(ctx)
	return rootCmd.ExecuteContext(ctx)
}
