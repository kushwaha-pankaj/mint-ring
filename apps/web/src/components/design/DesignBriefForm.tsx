"use client";

import {
  BAND_PROFILE_OPTIONS,
  BAND_STYLE_OPTIONS,
  DESIGN_PROMPT_PLACEHOLDER,
  FINISH_OPTIONS,
  isBriefReady,
  METAL_OPTIONS,
  MOOD_OPTIONS,
  OPTIONAL_DETAIL_OPTIONS,
  RING_TYPE_OPTIONS,
  SETTING_OPTIONS,
  STONE_OPTIONS,
  type DesignBrief,
} from "@/lib/design-brief";
import {
  bandProfileIcon,
  bandStyleIcon,
  extraDetailIcon,
  FINISH_SWATCHES,
  moodIcon,
  settingStyleIcon,
} from "@/lib/design-option-icons";
import { IconChevronRight } from "@/components/icons";
import { Button } from "@/components/ui";
import { DesignIconGrid } from "./DesignIconGrid";
import { ringTypeIcon, stoneShapeIcon } from "@/lib/design-option-icons";

export function DesignBriefForm({
  brief,
  onChange,
  onGenerate,
  generating,
  disabled,
}: {
  brief: DesignBrief;
  onChange: (patch: Partial<DesignBrief>) => void;
  onGenerate: () => void;
  generating?: boolean;
  disabled?: boolean;
}) {
  const canGenerate = isBriefReady(brief) && !generating && !disabled;

  const ringOptions = RING_TYPE_OPTIONS.map((o) => ({
    ...o,
    icon: ringTypeIcon(o.value),
  }));

  const stoneOptions = STONE_OPTIONS.map((o) => ({
    ...o,
    icon: stoneShapeIcon(o.value),
  }));

  const settingOptions = SETTING_OPTIONS.map((o) => ({
    ...o,
    icon: settingStyleIcon(o.value),
  }));

  const metalOptions = METAL_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
    swatch: o.swatch,
  }));

  const finishOptions = FINISH_OPTIONS.map((o) => ({
    ...o,
    swatch: FINISH_SWATCHES[o.value],
  }));

  const toggleDetail = (value: string) => {
    const set = new Set(brief.optionalDetails);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange({ optionalDetails: [...set] });
  };

  return (
    <div className="ds-form">
      <header className="ds-section-head">
        <p className="ds-section-num">1</p>
        <div>
          <h2 className="ds-section-title">Choose your design</h2>
          <p className="ds-section-hint">
            Structured options use the same vocabulary as catalogue analysis.
          </p>
        </div>
      </header>

      <DesignIconGrid
        label="Ring type"
        options={ringOptions}
        value={brief.ringType}
        onChange={(v) => onChange({ ringType: v })}
        disabled={disabled || generating}
        columns={4}
      />

      <DesignIconGrid
        label="Metal"
        options={metalOptions}
        value={brief.metal}
        onChange={(v) => onChange({ metal: v })}
        disabled={disabled || generating}
        columns={4}
      />

      <DesignIconGrid
        label="Centre stone shape"
        options={stoneOptions}
        value={brief.stone}
        onChange={(v) => onChange({ stone: v })}
        disabled={disabled || generating}
        columns={5}
      />

      <DesignIconGrid
        label="Setting style"
        options={settingOptions}
        value={brief.setting}
        onChange={(v) => onChange({ setting: v })}
        disabled={disabled || generating}
        columns={5}
      />

      <DesignIconGrid
        label="Band style"
        options={BAND_STYLE_OPTIONS.map((o) => ({
          ...o,
          icon: bandStyleIcon(o.value),
        }))}
        value={brief.bandStyle}
        onChange={(v) => onChange({ bandStyle: v })}
        disabled={disabled || generating}
        columns={4}
      />

      <DesignIconGrid
        label="Band profile"
        options={BAND_PROFILE_OPTIONS.map((o) => ({
          ...o,
          icon: bandProfileIcon(o.value),
        }))}
        value={brief.band}
        onChange={(v) => onChange({ band: v })}
        disabled={disabled || generating}
        columns={5}
      />

      <DesignIconGrid
        label="Finish"
        options={finishOptions}
        value={brief.finish}
        onChange={(v) => onChange({ finish: v })}
        disabled={disabled || generating}
        columns={5}
        variant="finish"
      />

      <DesignIconGrid
        label="Style mood"
        options={MOOD_OPTIONS.map((o) => ({ ...o, icon: moodIcon(o.value) }))}
        value={brief.mood}
        onChange={(v) => onChange({ mood: v })}
        disabled={disabled || generating}
        columns={4}
      />

      <DesignIconGrid
        label="Extra details (optional)"
        options={OPTIONAL_DETAIL_OPTIONS.map((o) => ({
          ...o,
          icon: extraDetailIcon(o.value),
        }))}
        values={brief.optionalDetails}
        onToggle={toggleDetail}
        disabled={disabled || generating}
        columns={4}
        mode="multi"
      />

      <header className="ds-section-head ds-section-head--prompt">
        <p className="ds-section-num">2</p>
        <div>
          <h2 className="ds-section-title">Tell us more about your idea</h2>
          <p className="ds-section-hint">
            Add emotion, proportion, or gem colour. We combine this with your selections.
          </p>
        </div>
      </header>

      <div className="ds-field">
        <label className="ds-field-label ds-sr-only" htmlFor="design-prompt">
          Design prompt
        </label>
        <textarea
          id="design-prompt"
          className="ds-textarea ds-textarea--prompt"
          rows={4}
          placeholder={DESIGN_PROMPT_PLACEHOLDER}
          value={brief.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          disabled={disabled || generating}
        />
      </div>

      <div className="ds-form-actions">
        <Button
          variant="primary"
          className="ds-generate-btn"
          disabled={!canGenerate}
          onClick={onGenerate}
          icon={<IconChevronRight size={18} className="ds-chevron-icon" />}
        >
          {generating ? "Generating your design..." : "Generate my design"}
        </Button>
      </div>
    </div>
  );
}

