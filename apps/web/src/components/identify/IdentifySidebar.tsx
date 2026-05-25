export function IdentifySidebar({ step }: { step: number }) {
  const copy =
    step >= 3
      ? {
          title: "Match complete",
          body: "Open Design analysis for attributes, or browse saved packs in Gallery.",
        }
      : step >= 2
        ? {
            title: "Matching",
            body: "We crop to the ring when a hand is detected, then search the reference gallery.",
          }
        : {
            title: "What happens next?",
            body: "Choose a demo sample or upload your own photograph. Face-on, steady light works best.",
          };

  return (
    <aside className="ds-sidebar" aria-labelledby="id-sidebar-heading">
      <div className="ds-sidebar-card ds-sidebar-card--identify">
        <header className="ds-sidebar-head">
          <SidebarIcon className="ds-sidebar-icon" />
          <h2 id="id-sidebar-heading" className="ds-sidebar-title ds-sidebar-title--serif">
            {copy.title}
          </h2>
        </header>
        <p className="ds-sidebar-body ds-sidebar-body--identify">{copy.body}</p>
        <p className="id-sidebar-gallery-note">
          Finished design packs are saved automatically in{" "}
          <a href="/gallery" className="id-sidebar-link">
            Gallery
          </a>
          .
        </p>
      </div>
    </aside>
  );
}

function SidebarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6v4l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
