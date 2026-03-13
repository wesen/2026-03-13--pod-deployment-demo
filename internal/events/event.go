package events

type Event struct {
	Type    string `json:"type"`
	TS      string `json:"ts"`
	Payload any    `json:"payload"`
}
