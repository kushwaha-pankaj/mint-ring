"use client";

import type { DesignBrief } from "@/lib/design-brief";
import { DesignWizardForm } from "./DesignWizardForm";

export function DesignBuilderColumn({
  step,
  brief,
  onChange,
  onNext,
  onBack,
  onGenerate,
  onEditPrompt,
  generating,
}: {
  step: number;
  brief: DesignBrief;
  onChange: (patch: Partial<DesignBrief>) => void;
  onNext: () => void;
  onBack: () => void;
  onGenerate: () => void;
  onEditPrompt: () => void;
  generating: boolean;
}) {
  return (
    <div className="ds-builder">
      <DesignWizardForm
        step={step}
        brief={brief}
        onChange={onChange}
        onNext={onNext}
        onBack={onBack}
        onGenerate={onGenerate}
        onEditPrompt={onEditPrompt}
        generating={generating}
      />
    </div>
  );
}