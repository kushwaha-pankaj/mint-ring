"use client";

const TIMELINE = [
  {
    title: "We'll review your design brief and prepare your AI.",
    icon: "doc",
  },
  {
    title: "Our AI will generate your selected outputs based on your preferences.",
    icon: "wand",
  },
  {
    title: "You'll get a complete design pack with all visuals and specifications.",
    icon: "image",
  },
] as const;

export function DesignReviewSidebar() {
  return (
    <aside className="ds-sidebar" aria-labelledby="ds-review-sidebar-heading">
      <div className="ds-sidebar-card ds-sidebar-card--review">
        <header className="ds-sidebar-head ds-sidebar-head--review">
          <ProcessIcon className="ds-sidebar-icon ds-sidebar-icon--review" />
          <h2 id="ds-review-sidebar-heading" className="ds-sidebar-title">
            What happens next?
          </h2>
        </header>

        <ol className="ds-timeline">
          {TIMELINE.map((step, i) => (
            <li key={step.title} className="ds-timeline-item">
              <div className="ds-timeline-track">
                <span className="ds-timeline-marker" aria-hidden>
                  <TimelineIcon type={step.icon} />
                </span>
                {i < TIMELINE.length - 1 && (
                  <span className="ds-timeline-arrow" aria-hidden>
                    <TimelineArrowIcon />
                  </span>
                )}
              </div>
              <div className="ds-timeline-copy">
                <p className="ds-timeline-title">{step.title}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="ds-security-box">
          <LockIcon />
          <p>
            <strong>Your design is private and secure.</strong>
            We never share your designs.
          </p>
        </div>

        <div className="ds-disclaimer-box">
          <p>
            <strong>Please note</strong>
            AI-generated visuals are for concept purposes only and may vary in the final handcrafted piece.
          </p>
        </div>
      </div>
    </aside>
  );
}

function ProcessIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <path
        d="M5 6h5a4 4 0 014 4v5m0 0l-3-3m3 3l3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TimelineArrowIcon() {
  return (
    <svg viewBox="0 0 16 20" className="ds-timeline-arrow-icon" fill="none" aria-hidden>
      <path
        d="M8 2v12M8 14l-3.5 3.5M8 14l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TimelineIcon({ type }: { type: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none">
      {type === "doc" && <path d="M7 4h7l3 3v13H7V4zm7 0v4h4M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
      {type === "wand" && <path d="M6 18l12-12M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
      {type === "image" && <path d="M5 6h14v12H5V6zm3 9l3-3 2 2 2-3 3 4M9 9h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="ds-security-icon" fill="none" aria-hidden>
      <rect x="4" y="9" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7 9V6a3 3 0 016 0v3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
