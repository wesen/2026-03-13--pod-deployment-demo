package runtime

import (
	"fmt"
	"math"
	"math/rand/v2"
	"sync"

	"github.com/dop251/goja"

	"github.com/manuel/wesen/pod-deployment-demo/internal/scenario/model"
)

// VM wraps a goja runtime with compiled phase programs and host primitives.
type VM struct {
	rt       *goja.Runtime
	programs map[string]*goja.Program

	mu   sync.Mutex
	kv   map[string]any
	logs []string
}

// NewVM creates a fresh goja runtime, registers host primitives, and compiles
// the four phase scripts from the given preset.
func NewVM(preset *model.Preset) (*VM, error) {
	rt := goja.New()
	vm := &VM{
		rt:       rt,
		programs: make(map[string]*goja.Program, 4),
		kv:       make(map[string]any),
	}

	// Register host primitives.
	for name, fn := range map[string]any{
		"getState":    vm.jsGetState,
		"setState":    vm.jsSetState,
		"log":         vm.jsLog,
		"randomFloat": vm.jsRandomFloat,
		"randomInt":   vm.jsRandomInt,
		"round":       vm.jsRound,
	} {
		if err := rt.Set(name, fn); err != nil {
			return nil, fmt.Errorf("set primitive %s: %w", name, err)
		}
	}

	// Compile phase scripts.
	phases := map[string]string{
		"observe": preset.Sources.Observe,
		"compare": preset.Sources.Compare,
		"plan":    preset.Sources.Plan,
		"execute": preset.Sources.Execute,
	}
	for name, src := range phases {
		prog, err := goja.Compile(name+".js", src, false)
		if err != nil {
			return nil, fmt.Errorf("compile %s.js: %w", name, err)
		}
		vm.programs[name] = prog

		// Run the script once so function declarations are available.
		if _, err := rt.RunProgram(prog); err != nil {
			return nil, fmt.Errorf("init %s.js: %w", name, err)
		}
	}

	return vm, nil
}

// RunObserve calls observe(desired) and returns the result.
func (vm *VM) RunObserve(desired map[string]any) (map[string]any, error) {
	return vm.callPhase("observe", desired)
}

// RunCompare calls compare(desired, actual) and returns the diff.
func (vm *VM) RunCompare(desired, actual map[string]any) (map[string]any, error) {
	return vm.callPhase2("compare", desired, actual)
}

// RunPlan calls plan(desired, actual, diff) and returns the actions array.
func (vm *VM) RunPlan(desired, actual, diff map[string]any) ([]any, error) {
	fn, ok := goja.AssertFunction(vm.rt.Get("plan"))
	if !ok {
		return nil, fmt.Errorf("plan is not a function")
	}
	v, err := fn(goja.Undefined(),
		vm.rt.ToValue(desired),
		vm.rt.ToValue(actual),
		vm.rt.ToValue(diff))
	if err != nil {
		return nil, fmt.Errorf("run plan: %w", err)
	}
	return exportSlice(v), nil
}

// RunExecute calls execute(desired, actual, diff, actions).
func (vm *VM) RunExecute(desired, actual, diff map[string]any, actions []any) error {
	fn, ok := goja.AssertFunction(vm.rt.Get("execute"))
	if !ok {
		return fmt.Errorf("execute is not a function")
	}
	_, err := fn(goja.Undefined(),
		vm.rt.ToValue(desired),
		vm.rt.ToValue(actual),
		vm.rt.ToValue(diff),
		vm.rt.ToValue(actions))
	if err != nil {
		return fmt.Errorf("run execute: %w", err)
	}
	return nil
}

// FlushLogs returns buffered log messages and resets the buffer.
func (vm *VM) FlushLogs() []string {
	vm.mu.Lock()
	defer vm.mu.Unlock()
	out := vm.logs
	vm.logs = nil
	return out
}

// --- host primitives ---

func (vm *VM) jsGetState(call goja.FunctionCall) goja.Value {
	key := call.Argument(0).String()
	vm.mu.Lock()
	defer vm.mu.Unlock()
	val, ok := vm.kv[key]
	if !ok {
		return goja.Null()
	}
	return vm.rt.ToValue(val)
}

func (vm *VM) jsSetState(call goja.FunctionCall) goja.Value {
	key := call.Argument(0).String()
	val := call.Argument(1).Export()
	vm.mu.Lock()
	defer vm.mu.Unlock()
	vm.kv[key] = val
	return goja.Undefined()
}

func (vm *VM) jsLog(call goja.FunctionCall) goja.Value {
	msg := call.Argument(0).String()
	vm.mu.Lock()
	defer vm.mu.Unlock()
	vm.logs = append(vm.logs, msg)
	return goja.Undefined()
}

func (vm *VM) jsRandomFloat(call goja.FunctionCall) goja.Value {
	min := call.Argument(0).ToFloat()
	max := call.Argument(1).ToFloat()
	return vm.rt.ToValue(min + rand.Float64()*(max-min))
}

func (vm *VM) jsRandomInt(call goja.FunctionCall) goja.Value {
	min := call.Argument(0).ToInteger()
	max := call.Argument(1).ToInteger()
	if max <= min {
		return vm.rt.ToValue(min)
	}
	return vm.rt.ToValue(min + rand.Int64N(max-min+1))
}

func (vm *VM) jsRound(call goja.FunctionCall) goja.Value {
	val := call.Argument(0).ToFloat()
	decimals := call.Argument(1).ToInteger()
	p := math.Pow(10, float64(decimals))
	return vm.rt.ToValue(math.Round(val*p) / p)
}

// --- helpers ---

func (vm *VM) callPhase(name string, desired map[string]any) (map[string]any, error) {
	fn, ok := goja.AssertFunction(vm.rt.Get(name))
	if !ok {
		return nil, fmt.Errorf("%s is not a function", name)
	}
	v, err := fn(goja.Undefined(), vm.rt.ToValue(desired))
	if err != nil {
		return nil, fmt.Errorf("run %s: %w", name, err)
	}
	return exportMap(v), nil
}

func (vm *VM) callPhase2(name string, a, b map[string]any) (map[string]any, error) {
	fn, ok := goja.AssertFunction(vm.rt.Get(name))
	if !ok {
		return nil, fmt.Errorf("%s is not a function", name)
	}
	v, err := fn(goja.Undefined(), vm.rt.ToValue(a), vm.rt.ToValue(b))
	if err != nil {
		return nil, fmt.Errorf("run %s: %w", name, err)
	}
	return exportMap(v), nil
}

func exportMap(v goja.Value) map[string]any {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return map[string]any{}
	}
	raw := v.Export()
	if m, ok := raw.(map[string]any); ok {
		return m
	}
	return map[string]any{}
}

func exportSlice(v goja.Value) []any {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return nil
	}
	raw := v.Export()
	if s, ok := raw.([]any); ok {
		return s
	}
	return nil
}
