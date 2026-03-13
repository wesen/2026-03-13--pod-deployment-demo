import { useEffect, useRef, useState } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";

import type { PresetSources } from "../types";

hljs.registerLanguage("javascript", javascript);

type PhaseKey = keyof PresetSources;

const PHASES: { key: PhaseKey; label: string }[] = [
  { key: "observe", label: "observe" },
  { key: "compare", label: "compare" },
  { key: "plan", label: "plan" },
  { key: "execute", label: "execute" },
];

export function CodePanel(props: {
  sources: PresetSources | null;
  loading: boolean;
}) {
  const [activePhase, setActivePhase] = useState<PhaseKey>("plan");
  const codeRef = useRef<HTMLElement>(null);
  const source = props.sources?.[activePhase] ?? "";

  useEffect(() => {
    if (codeRef.current && source) {
      codeRef.current.textContent = source;
      hljs.highlightElement(codeRef.current);
    }
  }, [source, activePhase]);

  const lines = source.split("\n");

  return (
    <div className="wb-panel wb-code-panel">
      <div className="wb-panel-head">
        <span className="wb-panel-label" style={{ color: "var(--wb-violet)" }}>
          Scenario code
        </span>
        <div className="wb-code-tabs">
          {PHASES.map((p) => (
            <button
              key={p.key}
              className={`wb-code-tab${activePhase === p.key ? " active" : ""}`}
              onClick={() => setActivePhase(p.key)}
            >
              {p.label}
              <span className="wb-code-tab-ext">.js</span>
            </button>
          ))}
        </div>
      </div>
      <div className="wb-code-body">
        {props.loading ? (
          <div className="wb-code-loading">Loading sources...</div>
        ) : !props.sources ? (
          <div className="wb-code-loading">No sources available</div>
        ) : (
          <div className="wb-code-scroll">
            <div className="wb-code-gutter" aria-hidden="true">
              {lines.map((_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            <pre className="wb-code-pre">
              <code ref={codeRef} className="language-javascript">
                {source}
              </code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
