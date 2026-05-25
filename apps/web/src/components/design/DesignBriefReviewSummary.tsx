"use client";

import { conceptRowsFromBrief } from "@/lib/design-concept";
import {
  OUTPUT_PACK_OPTIONS,
  buildBriefSentence,
  type DesignBrief,
} from "@/lib/design-brief";
import { reviewAttrIcon } from "@/lib/design-option-icons";
import { Check, PenLine } from "lucide-react";

export function DesignBriefReviewSummary({
  brief,
  variant = "results",
  onEditPrompt,
  editPromptDisabled,
}: {
  brief: DesignBrief;
  /** Step 4 uses numbered headings; results use plain labels. */
  variant?: "step4" | "results";
  onEditPrompt?: () => void;
  editPromptDisabled?: boolean;
}) {
  const titles =
    variant === "step4"
      ? {
          brief: "1. Design brief",
          prompt: "2. Your prompt",
          pack: "3. Output pack selected",
          packCopy: "Your AI design pack will include:",
        }
      : {
          brief: "Your design brief",
          prompt: "Your prompt",
          pack: "Output pack selected",
          packCopy: "Your AI design pack includes:",
        };
  const rows = conceptRowsFromBrief(brief);
  const selectedPack = OUTPUT_PACK_OPTIONS.filter((o) => brief.outputPack.includes(o.id));
  const promptPreview = brief.notes.trim() || buildBriefSentence(brief);

  return (
    <div className="ds-step4-top-grid ds-brief-review-summary">
      <section className="ds-review-section" aria-labelledby="ds-brief-review-choices">
        <h3 id="ds-brief-review-choices" className="ds-review-section-title">
          {titles.brief}
        </h3>
        {rows.length > 0 ? (
          <ul className="ds-review-attrs">
            {rows.map((row) => {
              const RowIcon = reviewAttrIcon(row.icon);
              return (
                <li key={row.key} className="ds-review-attr">
                  <span className="ds-review-attr-icon" aria-hidden>
                    <RowIcon className="ds-review-attr-svg" />
                  </span>
                  <span className="ds-review-attr-key">{row.key}</span>
                  <span className="ds-review-attr-value">{row.value}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ds-review-section-copy">No selections recorded yet.</p>
        )}
      </section>

      <section className="ds-review-section" aria-labelledby="ds-prompt-review-choices">
        <h3 id="ds-prompt-review-choices" className="ds-review-section-title">
          {titles.prompt}
        </h3>
        <div className="ds-prompt-box">
          <p>{promptPreview}</p>
        </div>
        {onEditPrompt && (
          <button
            type="button"
            className="ds-review-edit"
            onClick={onEditPrompt}
            disabled={editPromptDisabled}
          >
            <PenLine size={16} strokeWidth={1.5} aria-hidden />
            Edit prompt
          </button>
        )}
      </section>

      <section className="ds-review-section" aria-labelledby="ds-pack-review-choices">
        <h3 id="ds-pack-review-choices" className="ds-review-section-title">
          {titles.pack}
        </h3>
        <p className="ds-review-section-copy">{titles.packCopy}</p>
        <ul className="ds-pack-checklist">
          {selectedPack.map((item) => (
            <li key={item.id}>
              <Check size={14} strokeWidth={2.5} className="ds-check-icon" aria-hidden />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
