"use client";

import { validateBrief, type DesignBrief, type WizardStep } from "@/lib/design-brief";
import { DesignStep1Form } from "./DesignStep1Form";
import { DesignStep2Form } from "./DesignStep2Form";
import { DesignStep3Form } from "./DesignStep3Form";
import { DesignStep4Form } from "./DesignStep4Form";
import {
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconWand,
} from "@/components/icons";
import { Button } from "@/components/ui";
const STEP_META: Record<
  number,
  { title: string; hint: string; nextLabel: string; backLabel?: string }
> = {
  1: {
    title: "Choose the basics",
    hint: "Start by selecting the fundamental features of your ring.",
    nextLabel: "Continue to Design Details",
  },
  2: {
    title: "Add design details",
    hint: "Choose how your ring is styled with setting, band, finish and extra details.",
    nextLabel: "Continue to Inspiration & Prompt",
    backLabel: "Back to Basics",
  },
  3: {
    title: "Inspiration & prompt",
    hint: "Set the mood, add references, and choose what your design pack includes.",
    nextLabel: "Continue to Review & Generate",
    backLabel: "Back to Design Details",
  },
  4: {
    title: "Review & generate",
    hint: "Confirm your brief, then generate your design pack.",
    nextLabel: "Generate design pack",
    backLabel: "Back to Inspiration & Prompt",
  },
};

export function DesignWizardForm({
  step,
  brief,
  onChange,
  onNext,
  onBack,
  onGenerate,
  onEditPrompt,
  generating,
  disabled,
}: {
  step: number;
  brief: DesignBrief;
  onChange: (patch: Partial<DesignBrief>) => void;
  onNext: () => void;
  onBack: () => void;
  onGenerate: () => void;
  onEditPrompt: () => void;
  generating?: boolean;
  disabled?: boolean;
}) {
  const meta = STEP_META[step] ?? STEP_META[1];
  const validation = validateBrief(brief);
  const stepKey = (step as WizardStep);
  const stepIssues = validation.issues[stepKey] ?? [];
  const canNext = validation.canAdvance[stepKey] && !generating && !disabled;
  const canGenerate = validation.ok && !generating && !disabled;

  return (
    <div
      className={[
        "ds-wizard-card",
        step === 1 ? "ds-wizard-card--step1" : "",
        step === 2 ? "ds-wizard-card--step2" : "",
        step === 3 ? "ds-wizard-card--step3" : "",
        step === 4 ? "ds-wizard-card--step4" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="ds-wizard-head">
        <p className="ds-wizard-kicker">Step {step} of 4</p>
        <h2 className="ds-wizard-title">{meta.title}</h2>
        <p className="ds-wizard-hint">{meta.hint}</p>
        {stepIssues.length > 0 && (
          <div className="ds-wizard-checklist" aria-live="polite">
            <p className="ds-wizard-checklist-label">Still to choose</p>
            <ul className="ds-wizard-checklist-list">
              {stepIssues.map((issue) => (
                <li key={issue} className="ds-wizard-checklist-item">
                  <span className="ds-wizard-checklist-marker" aria-hidden />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      <div className="ds-form">
        {step === 1 && (
          <DesignStep1Form
            brief={brief}
            onChange={onChange}
            onNext={onNext}
            disabled={disabled || generating}
            canNext={canNext}
          />
        )}

        {step === 2 && (
          <DesignStep2Form brief={brief} onChange={onChange} disabled={disabled || generating} />
        )}

        {step === 3 && (
          <DesignStep3Form brief={brief} onChange={onChange} disabled={disabled || generating} />
        )}

        {step === 4 && (
          <DesignStep4Form
            brief={brief}
            onEditPrompt={onEditPrompt}
            generating={generating}
          />
        )}

        <div
          className={[
            "ds-wizard-actions",
            step >= 2 ? "ds-wizard-actions--split" : "",
            step === 1 ? "ds-wizard-actions--step1-hidden" : "",
            step === 4 ? "ds-wizard-actions--step4" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {step > 1 && (
            <Button
              variant="ghost"
              className="ds-wizard-back ds-wizard-back--outline"
              onClick={onBack}
              disabled={generating}
              icon={<IconChevronLeft size={18} className="ds-chevron-icon ds-chevron-icon--left" />}
              iconPosition="start"
            >
              {meta.backLabel ?? "Back"}
            </Button>
          )}

          {step === 4 && (
            <div className="ds-step4-generation-estimate" aria-label="Estimated generation time">
              <IconClock size={18} className="ds-clock-icon" />
              <span>Estimated generation time</span>
              <strong>45-90 seconds</strong>
            </div>
          )}

          {step < 4 ? (
            <Button
              variant="primary"
              className="ds-wizard-continue"
              disabled={!canNext}
              onClick={onNext}
              icon={<IconChevronRight size={18} className="ds-chevron-icon" />}
            >
              {meta.nextLabel}
            </Button>
          ) : (
            <div className="ds-step4-generate-wrap">
              <Button
                variant="primary"
                className="ds-wizard-continue"
                disabled={!canGenerate}
                onClick={onGenerate}
                icon={<IconWand size={18} className="ds-generate-icon" />}
              >
                {generating ? "Generating your design..." : meta.nextLabel}
              </Button>
              <p>You have 8 generations left today.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

