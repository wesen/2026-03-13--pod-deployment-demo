package doc

import (
	"testing"

	"github.com/go-go-golems/glazed/pkg/help"
)

func TestAddDocToHelpSystemLoadsProjectDocs(t *testing.T) {
	helpSystem := help.NewHelpSystem()

	if err := AddDocToHelpSystem(helpSystem); err != nil {
		t.Fatalf("load docs: %v", err)
	}

	for _, slug := range []string{
		"pod-deployment-demo",
		"runtime-architecture",
		"reconciliation-loop-reference",
		"authoring-scenarios",
		"operating-the-demo",
	} {
		if _, err := helpSystem.GetSectionWithSlug(slug); err != nil {
			t.Fatalf("expected slug %q to load: %v", slug, err)
		}
	}
}
