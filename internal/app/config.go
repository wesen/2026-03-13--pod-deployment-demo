package app

import (
	"os"

	"github.com/manuel/wesen/pod-deployment-demo/internal/project"
)

const defaultAddr = ":3001"

type Config struct {
	Addr         string
	ScenariosDir string
}

func LoadConfig() (Config, error) {
	addr := os.Getenv("ADDR")
	if addr == "" {
		addr = defaultAddr
	}

	scenariosDir := os.Getenv("SCENARIOS_DIR")
	if scenariosDir == "" {
		var err error
		scenariosDir, err = project.ScenariosDir()
		if err != nil {
			return Config{}, err
		}
	}

	return Config{
		Addr:         addr,
		ScenariosDir: scenariosDir,
	}, nil
}
