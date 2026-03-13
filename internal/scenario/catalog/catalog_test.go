package catalog

import (
	"path/filepath"
	"testing"
)

func TestLoadCatalog(t *testing.T) {
	t.Parallel()

	root := filepath.Join("..", "..", "..", "scenarios")
	catalog, err := Load(root)
	if err != nil {
		t.Fatalf("load catalog: %v", err)
	}

	if len(catalog.Presets) != 2 {
		t.Fatalf("expected 2 presets, got %d", len(catalog.Presets))
	}

	if _, ok := catalog.ByID("space-station"); !ok {
		t.Fatalf("expected space-station preset")
	}

	if _, ok := catalog.ByID("taco-fleet"); !ok {
		t.Fatalf("expected taco-fleet preset")
	}
}
