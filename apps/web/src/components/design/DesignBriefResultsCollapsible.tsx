"use client";

import { useId, useState } from "react";
import type { DesignBrief } from "@/lib/design-brief";
import { ChevronDown } from "lucide-react";
import { DesignBriefReviewSummary } from "./DesignBriefReviewSummary";

export function DesignBriefResultsCollapsible({ brief }: { brief: DesignBrief }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="ds-results-brief-panel" aria-label="Your design choices">
      <h2 className="ds-sr-only">Your design choices</h2>
      <button
        type="button"
        className="ds-results-brief-panel-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="ds-results-brief-panel-toggle-copy">
          <span className="thread thread-on-dark">Design session</span>
          <span className="ds-results-brief-panel-toggle-label">Your design choices</span>
        </span>
        <span className="ds-results-brief-panel-toggle-action">
          {open ? "Collapse" : "Expand"}
        </span>
        <ChevronDown
          className={`ds-results-brief-panel-chevron ${open ? "ds-results-brief-panel-chevron--open" : ""}`}
          size={20}
          strokeWidth={1.5}
          aria-hidden
        />
      </button>

      <div
        id={panelId}
        className={`ds-results-brief-panel-body ${open ? "ds-results-brief-panel-body--open" : ""}`}
        hidden={!open}
      >
        <DesignBriefReviewSummary brief={brief} variant="results" />
      </div>
    </section>
  );
}
