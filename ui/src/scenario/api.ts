import type { PresetMeta, PresetSources, Snapshot } from "./types";

async function parseJSON<T>(response: Response, context: string): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `${context} failed with ${response.status}`);
  }
  if (!text.trim()) {
    throw new Error(`empty json response from ${context}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(
      `invalid json from ${context}: ${error instanceof Error ? error.message : "parse failed"}`,
    );
  }
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return parseJSON<T>(response, url);
}

async function putJSON<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return parseJSON<T>(response, url);
}

type SnapshotEnvelope = {
  snapshot?: Snapshot;
};

function requireSnapshot(url: string, payload: SnapshotEnvelope): Snapshot {
  if (!payload.snapshot) {
    throw new Error(`missing snapshot response from ${url}`);
  }

  return payload.snapshot;
}

export async function listPresets(): Promise<PresetMeta[]> {
  const response = await fetch("/api/presets");
  return parseJSON<PresetMeta[]>(response, "/api/presets");
}

export async function fetchSnapshot(): Promise<Snapshot> {
  const response = await fetch("/api/session/snapshot");
  return parseJSON<Snapshot>(response, "/api/session/snapshot");
}

export async function switchPreset(presetId: string): Promise<Snapshot> {
  return requireSnapshot(
    "/api/session/preset",
    await postJSON<SnapshotEnvelope>("/api/session/preset", { presetId }),
  );
}

export async function runSession(): Promise<Snapshot> {
  return requireSnapshot("/api/session/run", await postJSON<SnapshotEnvelope>("/api/session/run", {}));
}

export async function pauseSession(): Promise<Snapshot> {
  return requireSnapshot(
    "/api/session/pause",
    await postJSON<SnapshotEnvelope>("/api/session/pause", {}),
  );
}

export async function stepSession(): Promise<Snapshot> {
  return requireSnapshot("/api/session/step", await postJSON<SnapshotEnvelope>("/api/session/step", {}));
}

export async function resetSession(): Promise<Snapshot> {
  return requireSnapshot(
    "/api/session/reset",
    await postJSON<SnapshotEnvelope>("/api/session/reset", {}),
  );
}

export async function setSessionSpeed(speedMs: number): Promise<Snapshot> {
  return requireSnapshot(
    "/api/session/speed",
    await postJSON<SnapshotEnvelope>("/api/session/speed", { speedMs }),
  );
}

export async function fetchPresetSources(presetId: string): Promise<PresetSources> {
  const response = await fetch(`/api/presets/${encodeURIComponent(presetId)}/sources`);
  return parseJSON<PresetSources>(response, `/api/presets/${presetId}/sources`);
}

export async function updateSessionSpec(spec: Record<string, unknown>): Promise<Snapshot> {
  return requireSnapshot(
    "/api/session/spec",
    await putJSON<SnapshotEnvelope>("/api/session/spec", spec),
  );
}
