import type { PresetMeta } from "../types";

export function PresetStrip(props: {
  presets: PresetMeta[];
  activePresetID: string;
  onSwitch: (id: string) => void;
}) {
  return (
    <div className="wb-presets">
      {props.presets.map((preset) => (
        <button
          key={preset.id}
          className={`wb-preset-card${props.activePresetID === preset.id ? " active" : ""}`}
          onClick={() => void props.onSwitch(preset.id)}
        >
          <span className="wb-preset-icon">{preset.icon}</span>
          <span className="wb-preset-name">{preset.name}</span>
          <span className="wb-preset-desc">{preset.description}</span>
        </button>
      ))}
    </div>
  );
}
