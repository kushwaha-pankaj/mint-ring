"use client";

import { conceptRowsFromBrief } from "@/lib/design-concept";
import type { DesignBrief } from "@/lib/design-brief";

const FLOW = [
  { label: "Review & Confirm", icon: "doc" },
  { label: "Generate", icon: "wand" },
  { label: "Get Your Design Pack", icon: "diamond" },
] as const;

export function DesignConceptSidebar({ brief }: { brief: DesignBrief }) {
  const rows = conceptRowsFromBrief(brief);

  return (
    <aside className="ds-sidebar" aria-labelledby="ds-concept-heading">
      <div className="ds-sidebar-card ds-sidebar-card--concept">
        <header className="ds-sidebar-head ds-sidebar-head--concept">
          <DirectionIcon className="ds-sidebar-icon ds-sidebar-icon--concept" />
          <h2 id="ds-concept-heading" className="ds-sidebar-title">
            Your Concept Direction
          </h2>
        </header>

        <ul className="ds-concept-list">
          {rows.length === 0 ? (
            <li className="ds-concept-empty">Complete earlier steps to see your direction.</li>
          ) : (
            rows.map((row) => (
              <li key={row.key} className="ds-concept-item">
                <ConceptIcon type={row.icon} />
                <span className="ds-concept-key">{row.key}</span>
                <span className="ds-concept-value">{row.value}</span>
              </li>
            ))
          )}
        </ul>

        <div className="ds-sidebar-flow ds-sidebar-flow--concept">
          <p className="ds-sidebar-flow-title">What&apos;s next?</p>
          <p className="ds-sidebar-flow-copy">
            Review your design brief and choose the generation outputs in the next step.
          </p>
          <ol className="ds-sidebar-flow-list">
            {FLOW.map((step, i) => (
              <li key={step.label} className="ds-sidebar-flow-item">
                <FlowIcon type={step.icon} />
                <span>{step.label}</span>
                {i < FLOW.length - 1 && <span className="ds-sidebar-flow-arrow">→</span>}
              </li>
            ))}
          </ol>
        </div>

        <p className="ds-sidebar-disclaimer">
          <InfoIcon /> AI-generated visuals are created after you click Generate Design Pack in the next step.
        </p>
      </div>
    </aside>
  );
}

function ConceptIcon({ type }: { type: string }) {
  return (
    <span className={`ds-concept-icon ds-concept-icon--${type}`} aria-hidden>
      <svg viewBox="0 0 20 20" fill="none">
        {type === "ring" && <path d="M5 14c0-4 2-6 5-6s5 2 5 6M7 8l3-4 3 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />}
        {type === "metal" && <path d="M10 4l5 6-5 6-5-6 5-6z" stroke="currentColor" strokeWidth="1.2" />}
        {type === "stone" && <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />}
        {type === "setting" && <path d="M10 4l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />}
        {type === "band" && <ellipse cx="10" cy="10" rx="7" ry="3" stroke="currentColor" strokeWidth="1.2" />}
        {type === "finish" && <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.2" />}
        {type === "extra" && <path d="M6 10h8M10 6v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />}
        {type === "mood" && <path d="M5 12c2.2-3.5 4.4-3.5 6.6 0 1.2 1.9 2.4 2.2 3.9.9M5 7.5c2.2-3.5 4.4-3.5 6.6 0 1.2 1.9 2.4 2.2 3.9.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />}
      </svg>
    </span>
  );
}

function FlowIcon({ type }: { type: string }) {
  return (
    <span className="ds-sidebar-flow-num" aria-hidden>
      <svg viewBox="0 0 24 24" fill="none">
        {type === "doc" && <path d="M7 4h7l3 3v13H7V4zm7 0v4h4M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
        {type === "wand" && <path d="M6 18l12-12M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
        {type === "diamond" && <path d="M5 9l3-4h8l3 4-7 10L5 9zm0 0h14M8 5l4 14 4-14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    </span>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7.5v3.5M8 5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DirectionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <path
        d="M4 16l4-10 3 6 5 2-12 2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
