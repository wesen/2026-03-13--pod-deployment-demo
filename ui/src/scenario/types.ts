export type PresetMeta = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

export type UIControl = {
  type: string;
  key?: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  children?: UIControl[];
};

export type Snapshot = {
  preset: { id: string; name: string; icon: string; description: string; initialTickMs: number };
  ui: UIControl[];
  tick: number;
  phase: string;
  desired: Record<string, unknown>;
  actual: Record<string, unknown>;
  diff: Record<string, unknown>;
  actions: unknown[];
  logs: string[];
  running: boolean;
  speedMs: number;
  allLogs: string[];
};

export type ServerEvent = {
  type: string;
  ts: string;
  payload: unknown;
};

export const EMPTY_SNAPSHOT: Snapshot = {
  preset: { id: "", name: "", icon: "", description: "", initialTickMs: 1000 },
  ui: [],
  tick: 0,
  phase: "idle",
  desired: {},
  actual: {},
  diff: {},
  actions: [],
  logs: [],
  running: false,
  speedMs: 1000,
  allLogs: [],
};
