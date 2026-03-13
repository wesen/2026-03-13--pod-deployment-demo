import { useCallback, useEffect, useState } from "react";

import {
  fetchSnapshot,
  listPresets,
  pauseSession,
  resetSession,
  runSession,
  setSessionSpeed,
  stepSession,
  switchPreset as switchPresetRequest,
  updateSessionSpec,
} from "./api";
import { reduceEvent } from "./reducer";
import { EMPTY_SNAPSHOT, type PresetMeta, type ServerEvent, type Snapshot } from "./types";

type SessionActions = {
  switchPreset: (id: string) => Promise<void>;
  run: () => Promise<void>;
  pause: () => Promise<void>;
  step: () => Promise<void>;
  reset: () => Promise<void>;
  setSpeed: (ms: number) => Promise<void>;
  updateSpec: (spec: Record<string, unknown>) => Promise<void>;
};

export function useScenarioSession(): {
  presets: PresetMeta[];
  snapshot: Snapshot;
  connected: boolean;
  error: string | null;
  actions: SessionActions;
} {
  const [presets, setPresets] = useState<PresetMeta[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPresets()
      .then(setPresets)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;

    const connect = async () => {
      try {
        const data = await fetchSnapshot();
        if (active) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "connection failed");
        }
      }

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${window.location.host}/ws`);

      socket.addEventListener("open", () => {
        if (active) {
          setConnected(true);
        }
      });

      socket.addEventListener("close", () => {
        if (active) {
          setConnected(false);
          window.setTimeout(() => {
            void connect();
          }, 1500);
        }
      });

      socket.addEventListener("message", (message) => {
        if (!active) {
          return;
        }
        if (typeof message.data !== "string" || message.data.trim() === "") {
          setError("empty websocket message from server");
          return;
        }

        try {
          const event = JSON.parse(message.data) as ServerEvent;
          setSnapshot((current) => reduceEvent(current, event));
        } catch (err) {
          setError(err instanceof Error ? err.message : "invalid websocket json");
        }
      });
    };

    void connect();

    return () => {
      active = false;
      socket?.close();
    };
  }, []);

  const runMutation = useCallback(async (mutation: () => Promise<Snapshot>, fallback: string) => {
    try {
      setSnapshot(await mutation());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
  }, []);

  return {
    presets,
    snapshot,
    connected,
    error,
    actions: {
      switchPreset: useCallback(
        async (id: string) => {
          await runMutation(() => switchPresetRequest(id), "failed to switch preset");
        },
        [runMutation],
      ),
      run: useCallback(async () => {
        await runMutation(runSession, "failed to run session");
      }, [runMutation]),
      pause: useCallback(async () => {
        await runMutation(pauseSession, "failed to pause session");
      }, [runMutation]),
      step: useCallback(async () => {
        await runMutation(stepSession, "failed to step session");
      }, [runMutation]),
      reset: useCallback(async () => {
        await runMutation(resetSession, "failed to reset session");
      }, [runMutation]),
      setSpeed: useCallback(
        async (ms: number) => {
          await runMutation(() => setSessionSpeed(ms), "failed to update speed");
        },
        [runMutation],
      ),
      updateSpec: useCallback(
        async (spec: Record<string, unknown>) => {
          await runMutation(() => updateSessionSpec(spec), "failed to update spec");
        },
        [runMutation],
      ),
    },
  };
}
