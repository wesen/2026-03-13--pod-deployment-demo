//go:build ignore

package main

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	root, err := findRepoRoot()
	if err != nil {
		panic(err)
	}

	buildCmd := exec.Command("npm", "--prefix", filepath.Join(root, "ui"), "run", "build")
	buildCmd.Stdout = os.Stdout
	buildCmd.Stderr = os.Stderr
	if err := buildCmd.Run(); err != nil {
		panic(fmt.Errorf("build frontend: %w", err))
	}

	srcDir := filepath.Join(root, "ui", "dist", "public")
	dstDir := filepath.Join(root, "internal", "web", "embed", "public")

	if err := os.RemoveAll(dstDir); err != nil {
		panic(err)
	}
	if err := os.MkdirAll(dstDir, 0o755); err != nil {
		panic(err)
	}

	if err := filepath.WalkDir(srcDir, func(current string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		rel, err := filepath.Rel(srcDir, current)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}

		target := filepath.Join(dstDir, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}

		return copyFile(current, target)
	}); err != nil {
		panic(err)
	}
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

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}

	return out.Close()
}
