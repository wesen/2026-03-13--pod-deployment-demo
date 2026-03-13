package project

import (
	"fmt"
	"os"
	"path/filepath"
)

func FindRepoRoot() (string, error) {
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

func ScenariosDir() (string, error) {
	root, err := FindRepoRoot()
	if err != nil {
		return "", err
	}

	return filepath.Join(root, "scenarios"), nil
}
