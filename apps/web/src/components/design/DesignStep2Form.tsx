"use client";

import { OPTIONAL_DETAIL_OPTIONS, type DesignBrief } from "@/lib/design-brief";
import {
  bandStyleIcon,
  extraDetailIcon,
  FINISH_SWATCHES,
  settingStyleIcon,
} from "@/lib/design-option-icons";
import { DesignFormSection } from "./DesignFormSection";
import { DesignIconGrid } from "./DesignIconGrid";

const SETTING_ORDER = [
  "Solitaire",
  "Halo",
  "Bezel",
  "Pavé",
  "Three stone",
  "Channel",
  "Hidden halo",
  "Claw",
  "Tension",
] as const;

const BAND_ORDER = [
  "Plain",
  "Pavé",
  "Twisted",
  "Split shank",
  "Tapered",
  "Slim",
  "Bold",
  "Vintage",
  "Knife edge",
] as const;

const FINISH_ORDER = ["Polished", "Matte", "Brushed", "Hammered", "Satin"] as const;

const EXTRA_ORDER = [
  "Hidden halo",
  "Side stones",
  "Engraving",
  "Milgrain",
  "Mixed metal",
  "Matching band",
  "Cathedral setting",
] as const;

function labelForSetting(value: string): string {
  const map: Record<string, string> = {
    "Three stone": "Three Stone",
    "Hidden halo": "Hidden Halo",
  };
  return map[value] ?? value;
}

function labelForBand(value: string): string {
  const map: Record<string, string> = {
    "Split shank": "Split Shank",
    "Knife edge": "Knife Edge",
  };
  return map[value] ?? value;
}

function labelForExtra(value: string): string {
  const opt = OPTIONAL_DETAIL_OPTIONS.find((o) => o.value === value);
  if (opt) {
    const map: Record<string, string> = {
      "Hidden halo": "Hidden Halo",
      "Side stones": "Side Stones",
      "Mixed metal": "Mixed Metal",
      "Matching band": "Matching Band",
      "Cathedral setting": "Cathedral Setting",
    };
    return map[value] ?? opt.label;
  }
  return value;
}

export function DesignStep2Form({
  brief,
  onChange,
  disabled,
}: {
  brief: DesignBrief;
  onChange: (patch: Partial<DesignBrief>) => void;
  disabled?: boolean;
}) {
  const settingOptions = SETTING_ORDER.map((value) => ({
    value,
    label: labelForSetting(value),
    icon: settingStyleIcon(value),
  }));

  const bandOptions = BAND_ORDER.map((value) => ({
    value,
    label: labelForBand(value),
    icon: bandStyleIcon(value),
  }));

  const finishOptions = FINISH_ORDER.map((value) => ({
    value,
    label: value,
    swatch: FINISH_SWATCHES[value],
  }));

  const extraOptions = EXTRA_ORDER.map((value) => ({
    value,
    label: labelForExtra(value),
    icon: extraDetailIcon(value),
  }));

  const toggleDetail = (value: string) => {
    const set = new Set(brief.optionalDetails);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange({ optionalDetails: [...set] });
  };

  return (
    <div className="ds-step2-form">
      <DesignFormSection num={1} label="Setting Style">
        <DesignIconGrid
          label="Setting style"
          hideLegend
          options={settingOptions}
          value={brief.setting}
          onChange={(v) => onChange({ setting: v })}
          disabled={disabled}
          columns={5}
          tileSize="lg"
        />
      </DesignFormSection>

      <DesignFormSection num={2} label="Band Style">
        <DesignIconGrid
          label="Band style"
          hideLegend
          options={bandOptions}
          value={brief.bandStyle}
          onChange={(v) => onChange({ bandStyle: v })}
          disabled={disabled}
          columns={5}
          tileSize="lg"
        />
      </DesignFormSection>

      <DesignFormSection num={3} label="Finish">
        <DesignIconGrid
          label="Finish"
          hideLegend
          options={finishOptions}
          value={brief.finish}
          onChange={(v) => onChange({ finish: v })}
          disabled={disabled}
          columns={5}
          variant="finish"
        />
      </DesignFormSection>

      <DesignFormSection num={4} label="Extra Details (Optional)">
        <DesignIconGrid
          label="Extra details"
          hideLegend
          options={extraOptions}
          values={brief.optionalDetails}
          onToggle={toggleDetail}
          disabled={disabled}
          columns={4}
          mode="multi"
        />
      </DesignFormSection>
    </div>
  );
}
