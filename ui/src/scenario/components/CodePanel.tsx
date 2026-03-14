import { useMemo, useState } from "react";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";

import type { PresetSources } from "../types";

hljs.registerLanguage("javascript", javascript);

type PhaseKey = keyof PresetSources;

const PHASES: { key: PhaseKey; label: string; accent: string }[] = [
  { key: "observe", label: "observe", accent: "var(--green)" },
  { key: "compare", label: "compare", accent: "var(--amber)" },
  { key: "plan", label: "plan", accent: "var(--wb-violet)" },
  { key: "execute", label: "execute", accent: "var(--wb-rose)" },
];

export function CodePanel(props: {
  sources: PresetSources | null;
  loading: boolean;
}) {
  const [activePhase, setActivePhase] = useState<PhaseKey>("plan");
  const source = props.sources?.[activePhase] ?? "";
  const activeAccent = PHASES.find((p) => p.key === activePhase)?.accent ?? "var(--wb-violet)";

  const highlighted = useMemo(() => {
    if (!source) return "";
    return hljs.highlight(source, { language: "javascript" }).value;
  }, [source]);

  const lineCount = source ? source.split("\n").length : 0;

  return (
    <div className="wb-panel wb-code-panel">
      <div className="wb-code-header">
        <div className="wb-code-file-indicator">
          <span className="wb-code-dot" style={{ background: activeAccent }} />
          <span className="wb-code-filename">{activePhase}.js</span>
          <span className="wb-code-line-count">{lineCount} lines</span>
        </div>
        <div className="wb-code-tabs">
          {PHASES.map((p) => (
            <button
              key={p.key}
              className={`wb-code-tab${activePhase === p.key ? " active" : ""}`}
              onClick={() => setActivePhase(p.key)}
              style={activePhase === p.key ? { "--tab-accent": p.accent } as React.CSSProperties : undefined}
            >
              <span className="wb-code-tab-name">{p.label}</span>
              <span className="wb-code-tab-ext">.js</span>
            </button>
          ))}
        </div>
      </div>
      <div className="wb-code-body">
        {props.loading ? (
          <div className="wb-code-empty">
            <span className="wb-code-empty-pulse" />
            Loading sources...
          </div>
        ) : !props.sources ? (
          <div className="wb-code-empty">No sources available</div>
        ) : (
          <div className="wb-code-scroll">
            <div className="wb-code-gutter" aria-hidden="true">
              {Array.from({ length: lineCount }, (_, i) => (
                <span key={i}>{i + 1}</span>
              ))}
            </div>
            <pre className="wb-code-pre">
              <code
                className="wb-code-highlighted"
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
