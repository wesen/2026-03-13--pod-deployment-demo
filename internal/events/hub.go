package events

import (
	"sync"
	"sync/atomic"
	"time"
)

type Hub struct {
	mu          sync.RWMutex
	nextID      atomic.Uint64
	subscribers map[uint64]chan Event
}

func NewHub() *Hub {
	return &Hub{
		subscribers: make(map[uint64]chan Event),
	}
}

func (h *Hub) Subscribe() (<-chan Event, func()) {
	id := h.nextID.Add(1)
	ch := make(chan Event, 64)

	h.mu.Lock()
	h.subscribers[id] = ch
	h.mu.Unlock()

	return ch, func() {
		h.mu.Lock()
		defer h.mu.Unlock()

		if subscriber, ok := h.subscribers[id]; ok {
			delete(h.subscribers, id)
			close(subscriber)
		}
	}
}

func (h *Hub) Publish(eventType string, payload interface{}) {
	event := Event{
		Type:    eventType,
		TS:      time.Now().UTC().Format(time.RFC3339),
		Payload: payload,
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, subscriber := range h.subscribers {
		select {
		case subscriber <- event:
		default:
		}
	}
}
