package catalog

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/model"
)

type Catalog struct {
	Root    string
	Presets []model.Preset
}

func Load(root string) (*Catalog, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("read scenarios root: %w", err)
	}

	presets := make([]model.Preset, 0, len(entries))
	seen := map[string]struct{}{}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		dir := filepath.Join(root, entry.Name())
		preset, err := loadPreset(dir)
		if err != nil {
			return nil, err
		}

		if _, ok := seen[preset.Metadata.ID]; ok {
			return nil, fmt.Errorf("duplicate preset id %q", preset.Metadata.ID)
		}
		seen[preset.Metadata.ID] = struct{}{}

		presets = append(presets, preset)
	}

	slices.SortFunc(presets, func(a, b model.Preset) int {
		return strings.Compare(a.Metadata.ID, b.Metadata.ID)
	})

	return &Catalog{
		Root:    root,
		Presets: presets,
	}, nil
}

func (c *Catalog) ByID(id string) (model.Preset, bool) {
	for _, preset := range c.Presets {
		if preset.Metadata.ID == id {
			return preset, true
		}
	}

	return model.Preset{}, false
}

func loadPreset(dir string) (model.Preset, error) {
	read := func(name string) ([]byte, error) {
		data, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", filepath.Join(dir, name), err)
		}

		return data, nil
	}

	var metadata model.Metadata
	if data, err := read("scenario.json"); err != nil {
		return model.Preset{}, err
	} else if err := json.Unmarshal(data, &metadata); err != nil {
		return model.Preset{}, fmt.Errorf("parse %s: %w", filepath.Join(dir, "scenario.json"), err)
	}

	var spec map[string]any
	specData, err := read("spec.json")
	if err != nil {
		return model.Preset{}, err
	}
	if err := json.Unmarshal(specData, &spec); err != nil {
		return model.Preset{}, fmt.Errorf("parse %s: %w", filepath.Join(dir, "spec.json"), err)
	}

	var ui []model.Control
	if data, err := read("ui.json"); err != nil {
		return model.Preset{}, err
	} else if err := json.Unmarshal(data, &ui); err != nil {
		return model.Preset{}, fmt.Errorf("parse %s: %w", filepath.Join(dir, "ui.json"), err)
	}

	observe, err := read("observe.js")
	if err != nil {
		return model.Preset{}, err
	}
	compare, err := read("compare.js")
	if err != nil {
		return model.Preset{}, err
	}
	plan, err := read("plan.js")
	if err != nil {
		return model.Preset{}, err
	}
	execute, err := read("execute.js")
	if err != nil {
		return model.Preset{}, err
	}

	return model.Preset{
		Metadata: metadata,
		Spec:     spec,
		SpecJSON: string(specData),
		UI:       ui,
		Sources: model.Sources{
			Observe: string(observe),
			Compare: string(compare),
			Plan:    string(plan),
			Execute: string(execute),
		},
		Dir: dir,
	}, nil
}
