"use client";

import {
  OUTPUT_PACK_OPTIONS,
  type DesignBrief,
} from "@/lib/design-brief";
import { outputPackPreviewIcon } from "@/lib/design-option-icons";
import { DesignBriefReviewSummary } from "@/components/design/DesignBriefReviewSummary";
import { Info } from "lucide-react";

export function DesignStep4Form({
  brief,
  onEditPrompt,
  generating,
}: {
  brief: DesignBrief;
  onEditPrompt: () => void;
  generating?: boolean;
}) {
  const selectedPack = OUTPUT_PACK_OPTIONS.filter((o) => brief.outputPack.includes(o.id));

  return (
    <div className="ds-step4">
      <DesignBriefReviewSummary
        brief={brief}
        variant="step4"
        onEditPrompt={onEditPrompt}
        editPromptDisabled={generating}
      />

      <section className="ds-review-section ds-review-section--preview" aria-labelledby="ds-preview-review">
        <h3 id="ds-preview-review" className="ds-review-section-title">
          4. Preview of what will be generated <span>(after you click Generate Design Pack)</span>
        </h3>
        <div className="ds-preview-cards">
          {selectedPack.map((item) => {
            const PreviewIcon = outputPackPreviewIcon(item.id);
            return (
              <figure key={item.id} className="ds-preview-card">
                <PreviewIcon className="ds-preview-card-icon" />
                <figcaption>
                  <strong>{item.label}</strong>
                  <span>
                    {item.id === "angles"
                      ? "4 views will be generated"
                      : item.id === "lighting"
                        ? "4 lighting styles"
                        : item.id === "spec"
                          ? "Will be estimated"
                          : "Will be generated"}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </section>

      <p className="ds-step4-note">
        <Info size={16} className="ds-step4-note-icon" aria-hidden />
        Generation time may vary based on complexity and server load.
      </p>
    </div>
  );
}
