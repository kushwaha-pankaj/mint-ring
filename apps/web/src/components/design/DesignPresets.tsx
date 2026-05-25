"use client";

import { DESIGN_PRESETS, type DesignBrief } from "@/lib/design-brief";

export function DesignPresets({
  onSelect,
  activeId,
  disabled,
}: {
  onSelect: (brief: DesignBrief, id: string) => void;
  activeId: string | null;
  disabled?: boolean;
}) {
  return (
    <div className="ds-presets">
      <header className="studio-intro">
        <p className="studio-label">Quick start</p>
        <h2 className="studio-heading">Starter briefs</h2>
      </header>

      <ul className="ds-preset-list">
        {DESIGN_PRESETS.map((preset) => {
          const isActive = activeId === preset.id;
          return (
            <li key={preset.id}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={isActive}
                className={`ds-preset-btn ${isActive ? "ds-preset-btn--active" : ""}`}
                onClick={() => onSelect(preset.brief, preset.id)}
              >
                <span className="ds-preset-btn-title">{preset.label}</span>
                <span className="ds-preset-btn-meta">{preset.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
