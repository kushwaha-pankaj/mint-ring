"use client";

const WHATS_NEXT: Record<number, { title: string; body: string }> = {
  1: {
    title: "What's next?",
    body: "You'll refine the setting style, band style, finish and extra details in Step 2.",
  },
  2: {
    title: "What's next?",
    body: "In Step 3 you can set style mood, add inspiration images, and choose your output pack.",
  },
};

export function DesignWhatsNextSidebar({ step }: { step: number }) {
  const copy = WHATS_NEXT[step] ?? WHATS_NEXT[1];
  const isStep1 = step === 1;

  return (
    <aside
      className={`ds-sidebar ${isStep1 ? "ds-sidebar--step1" : ""}`}
      aria-labelledby="ds-sidebar-heading"
    >
      <div className={`ds-sidebar-card ${isStep1 ? "ds-sidebar-card--step1" : ""}`}>
        <header className={`ds-sidebar-head ${isStep1 ? "ds-sidebar-head--step1" : ""}`}>
          <SidebarHeadingIcon className="ds-sidebar-icon" />
          <h2
            id="ds-sidebar-heading"
            className={`ds-sidebar-title ${isStep1 ? "ds-sidebar-title--serif" : ""}`}
          >
            {copy.title}
          </h2>
        </header>

        <p className={`ds-sidebar-body ${isStep1 ? "ds-sidebar-body--step1" : ""}`}>{copy.body}</p>

        <div className={`ds-sidebar-preview ${isStep1 ? "ds-sidebar-preview--step1" : ""}`} aria-hidden>
          {isStep1 ? (
            <div className="ds-sidebar-preview-step1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/design/hero-ring-sketch.svg"
                alt=""
                className="ds-sidebar-preview-step1-art"
              />
              <p className="ds-sidebar-preview-caption ds-sidebar-preview-caption--step1">
                Visuals will be generated after you review and confirm your design in Step 4.
              </p>
            </div>
          ) : (
            <>
              <div className="ds-sidebar-preview-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/design/hero-ring-sketch.svg" alt="" className="ds-sidebar-preview-ring" />
              </div>
              <p className="ds-sidebar-preview-caption">
                Visuals will be generated after you review and confirm your design in Step 4.
              </p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function SidebarHeadingIcon({ className }: { className?: string }) {
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
