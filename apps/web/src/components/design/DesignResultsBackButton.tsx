"use client";

export function DesignResultsBackButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="ds-results-toolbar">
      <button type="button" className="ds-results-back" onClick={onClick}>
        <ResultsBackIcon />
        Back to Design Steps
      </button>
    </div>
  );
}

function ResultsBackIcon() {
  return (
    <svg viewBox="0 0 20 20" className="ds-results-back__icon" fill="none" aria-hidden>
      <path
        d="M12 5l-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
