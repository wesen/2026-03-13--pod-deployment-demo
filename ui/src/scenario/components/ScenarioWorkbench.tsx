import { useCallback, useEffect, useRef, useState } from "react";

import { SpecPanel } from "./SpecPanel";
import { PresetStrip } from "./PresetStrip";
import { RuntimeLogPanel } from "./RuntimeLogPanel";
import { StatePanels } from "./StatePanels";
import { TransportBar } from "./TransportBar";
import { useScenarioSession } from "../useScenarioSession";

export function ScenarioWorkbench() {
  const { presets, snapshot, connected, error, actions } = useScenarioSession();
  const [rawMode, setRawMode] = useState(false);
  const [jsonDraft, setJsonDraft] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [snapshot.allLogs?.length]);

  useEffect(() => {
    if (!rawMode) {
      setJsonDraft(JSON.stringify(snapshot.desired, null, 2));
    }
  }, [snapshot.desired, rawMode]);

  const updateSpecKey = useCallback(
    (key: string, value: unknown) => {
      const next = { ...snapshot.desired, [key]: value };
      void actions.updateSpec(next);
    },
    [actions, snapshot.desired],
  );

  const saveRawJSON = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft) as Record<string, unknown>;
      setEditorError(null);
      void actions.updateSpec(parsed);
    } catch {
      setEditorError("Invalid JSON in spec editor");
    }
  }, [actions, jsonDraft]);

  return (
    <main className="scenario-wb">
      <header className="wb-header">
        <h1 className="wb-title">
          <span className={`wb-title-dot${error ? " error" : connected ? "" : " off"}`} />
          Reconcile workbench
        </h1>
        <span className={`wb-conn${connected ? " live" : ""}`}>
          {connected ? "ws live" : "ws reconnecting"}
        </span>
      </header>

      {(error || editorError) && <div className="wb-error">{editorError ?? error}</div>}

      <PresetStrip
        presets={presets}
        activePresetID={snapshot.preset.id}
        onSwitch={(id) => void actions.switchPreset(id)}
      />

      <TransportBar
        running={snapshot.running}
        tick={snapshot.tick}
        phase={snapshot.phase}
        speedMs={snapshot.speedMs}
        onRunPause={() => void (snapshot.running ? actions.pause() : actions.run())}
        onStep={() => void actions.step()}
        onReset={() => void actions.reset()}
        onSpeedChange={(speedMs) => void actions.setSpeed(speedMs)}
      />

      <div className="wb-grid">
        <SpecPanel
          rawMode={rawMode}
          jsonDraft={jsonDraft}
          desired={snapshot.desired}
          ui={snapshot.ui}
          onToggleMode={() => {
            setEditorError(null);
            setRawMode((current) => !current);
          }}
          onJsonDraftChange={setJsonDraft}
          onSaveRawJSON={saveRawJSON}
          onUpdateSpecKey={updateSpecKey}
        />
        <StatePanels actual={snapshot.actual} diff={snapshot.diff} actions={snapshot.actions ?? []} />
      </div>

      <RuntimeLogPanel lines={snapshot.allLogs ?? []} logEndRef={logEndRef} />
    </main>
  );
}
