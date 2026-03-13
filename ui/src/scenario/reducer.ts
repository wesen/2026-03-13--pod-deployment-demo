import type { ServerEvent, Snapshot } from "./types";

export function reduceEvent(current: Snapshot, event: ServerEvent): Snapshot {
  switch (event.type) {
    case "snapshot":
      return event.payload as Snapshot;
    case "snapshot.updated":
      return { ...current, ...(event.payload as Partial<Snapshot>) };
    case "preset.changed":
      return { ...current, ...(event.payload as Partial<Snapshot>), allLogs: [] };
    case "session.state":
      return { ...current, ...(event.payload as Partial<Snapshot>) };
    case "session.reset":
      return { ...current, ...(event.payload as Partial<Snapshot>), allLogs: [] };
    case "runtime.error": {
      const payload = event.payload as { error: string };
      return { ...current, phase: "error:" + payload.error };
    }
    default:
      return current;
  }
}
