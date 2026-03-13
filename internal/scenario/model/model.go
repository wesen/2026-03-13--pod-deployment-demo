package model

type Metadata struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Icon        string `json:"icon"`
	Description string `json:"description"`
	InitialTick int    `json:"initialTickMs"`
}

type Control struct {
	Type     string    `json:"type"`
	Key      string    `json:"key,omitempty"`
	Label    string    `json:"label"`
	Min      *float64  `json:"min,omitempty"`
	Max      *float64  `json:"max,omitempty"`
	Step     *float64  `json:"step,omitempty"`
	Options  []string  `json:"options,omitempty"`
	Children []Control `json:"children,omitempty"`
}

type Sources struct {
	Observe string `json:"observe"`
	Compare string `json:"compare"`
	Plan    string `json:"plan"`
	Execute string `json:"execute"`
}

type Preset struct {
	Metadata Metadata       `json:"metadata"`
	Spec     map[string]any `json:"spec"`
	SpecJSON string         `json:"specJson"`
	UI       []Control      `json:"ui"`
	Sources  Sources        `json:"sources"`
	Dir      string         `json:"dir"`
}
