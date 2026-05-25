"use client";

import { selectionSummaryRowsFromBrief } from "@/lib/design-selection-summary";
import type { DesignBrief } from "@/lib/design-brief";

export function DesignSelectionSummarySidebar({ brief }: { brief: DesignBrief }) {
  const rows = selectionSummaryRowsFromBrief(brief);

  return (
    <aside className="ds-sidebar" aria-labelledby="ds-summary-heading">
      <div className="ds-sidebar-card ds-sidebar-card--summary">
        <h2 id="ds-summary-heading" className="ds-summary-title">
          Your Selection Summary
        </h2>

        <ul className="ds-summary-list">
          {rows.length === 0 ? (
            <li className="ds-summary-empty">Complete Step 1 to see your selections.</li>
          ) : (
            rows.map((row) => (
              <li
                key={row.key}
                className={`ds-summary-item ${row.dividerBefore ? "ds-summary-item--divider" : ""}`}
              >
                <SummaryIcon type={row.icon} />
                <div className="ds-summary-copy">
                  <span className="ds-summary-key">{row.key}</span>
                  <span className="ds-summary-value">{row.value}</span>
                </div>
              </li>
            ))
          )}
        </ul>

        <div className="ds-summary-next">
          <NextStepIcon className="ds-summary-next-icon" />
          <div>
            <p className="ds-summary-next-title">What&apos;s next?</p>
            <p className="ds-summary-next-body">
              Add your style mood, upload inspiration and describe your idea in Step 3.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SummaryIcon({ type }: { type: string }) {
  return (
    <span className={`ds-summary-icon ds-summary-icon--${type}`} aria-hidden>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2">
        {type === "ring" && (
          <>
            <circle cx="10" cy="9" r="3.5" />
            <path d="M4 15c0-4 2.5-6 6-6s6 2 6 6" />
          </>
        )}
        {type === "metal" && <circle cx="10" cy="10" r="6" />}
        {type === "stone" && <path d="M10 4l5 8H5L10 4z" />}
        {type === "setting" && (
          <>
            <circle cx="10" cy="9" r="3" />
            <circle cx="10" cy="9" r="5.5" strokeDasharray="2 2" />
          </>
        )}
        {type === "band" && <ellipse cx="10" cy="11" rx="7" ry="4" />}
        {type === "finish" && (
          <>
            <circle cx="10" cy="10" r="5" />
            <path d="M6 10h8" />
          </>
        )}
        {type === "extra" && (
          <>
            <circle cx="7" cy="10" r="2" />
            <circle cx="13" cy="10" r="2" />
          </>
        )}
      </svg>
    </span>
  );
}

function NextStepIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <path
        d="M5 10h9m0 0l-3.5-3.5M14 10l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
