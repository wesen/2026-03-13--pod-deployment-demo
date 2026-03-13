package main

import (
	"encoding/json"
	"fmt"

	"github.com/manuel/wesen/pod-deployment-demo/internal/events"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/catalog"
	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/runtime"
)

func main() {
	cat, err := catalog.Load("scenarios")
	if err != nil {
		panic(err)
	}

	first := cat.Presets[0]
	sess, err := runtime.NewSession(&first, events.NewHub())
	if err != nil {
		panic(err)
	}

	zombie, ok := cat.ByID("zombie-fleet")
	if !ok {
		panic("zombie-fleet preset not found")
	}
	if err := sess.SwitchPreset(&zombie); err != nil {
		panic(err)
	}

	for i := 0; i < 3; i++ {
		if i > 0 {
			if _, err := sess.Step(); err != nil {
				fmt.Printf("step %d error: %v\n", i, err)
			}
		}

		state := sess.CurrentSnapshot()
		data, err := json.Marshal(state)
		fmt.Printf("snapshot %d marshal err: %v\n", i, err)
		fmt.Printf("snapshot %d payload len: %d\n", i, len(data))
		fmt.Printf("snapshot %d payload: %s\n", i, data)
	}
}
