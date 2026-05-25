"use client";

import { SAMPLE_PICKS, fetchSampleAsFile } from "@/lib/sample";

export function SamplePicks({
  onPick,
  disabled,
  activePickId,
  loading,
}: {
  onPick: (file: File, sampleId: string) => void;
  disabled?: boolean;
  activePickId?: string | null;
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="sample-picks">
      <header className="studio-intro">
        <p className="studio-label">Quick start</p>
        <h2 className="studio-heading">Sample rings</h2>
        <p className="studio-hint">Tap to identify instantly. Ideal for live demos.</p>
      </header>

      <ul className="pick-grid">
        {SAMPLE_PICKS.map((sample) => {
          const isActive = activePickId === sample.id;
          const isLoading = loading && activePickId === sample.id;

          return (
            <li key={sample.id}>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Try ${sample.label}`}
                aria-pressed={isActive}
                onClick={async () => {
                  const file = await fetchSampleAsFile(sample.image);
                  onPick(file, sample.id);
                }}
                className={`pick-card ${isActive ? "pick-card--active" : ""} ${
                  isLoading ? "pick-card--waiting" : ""
                }`}
              >
                <span className="pick-card-visual">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sample.image}
                    alt=""
                    className="pick-card-img"
                  />
                  {isActive && <span className="pick-card-badge">Selected</span>}
                </span>
                <span className="pick-card-footer">
                  <span className="pick-card-name">{sample.label}</span>
                  <span className="pick-card-action">Tap to identify</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
