import { describe, expect, it } from "vitest";

import { decodeServerEventMessage, reduceEvent } from "./reducer";
import { EMPTY_SNAPSHOT } from "./types";

describe("decodeServerEventMessage", () => {
  it("rejects empty websocket payloads", () => {
    expect(() => decodeServerEventMessage("")).toThrow("empty websocket message from server");
  });

  it("rejects malformed websocket json", () => {
    expect(() => decodeServerEventMessage("{")).toThrow("invalid websocket json");
  });
});

describe("reduceEvent", () => {
  it("merges snapshot.updated payloads into the current snapshot", () => {
    const next = reduceEvent(EMPTY_SNAPSHOT, {
      type: "snapshot.updated",
      ts: "2026-03-13T00:00:00Z",
      payload: {
        tick: 4,
        phase: "reconciling",
        actual: { trucks: 3 },
        allLogs: ["scaled trucks to 3"],
      },
    });

    expect(next.tick).toBe(4);
    expect(next.phase).toBe("reconciling");
    expect(next.actual).toEqual({ trucks: 3 });
    expect(next.allLogs).toEqual(["scaled trucks to 3"]);
  });
});
