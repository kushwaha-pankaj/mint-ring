"use client";

import type { AnalyseResult } from "@/lib/api";
import { IconRefresh } from "@/components/icons";
import { Button } from "@/components/ui";
import { RingThumb } from "./RingThumb";

/**
 * Design analysis: customer-facing attribute estimates plus technical scores.
 */
export function Analysis({
  result,
  loading,
  error,
  onRetry,
  imageSrc,
  imageCaption = "Your photograph",
}: {
  result: AnalyseResult | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  imageSrc?: string;
  imageCaption?: string;
}) {
  const analysedVisual = imageSrc ? (
    <figure className="analysis-reference">
      <div className="analysis-reference-media">
        <RingThumb src={imageSrc} alt={imageCaption} size="md" fill />
      </div>
      <figcaption>{imageCaption}</figcaption>
    </figure>
  ) : null;

  if (loading && !result) {
    return (
      <section className="analysis analysis--busy" aria-busy="true" id="design-analysis">
        {analysedVisual}
        <header className="analysis-header">
          <p className="studio-label">Design analysis</p>
          <h3 className="analysis-heading font-display studio-section-title">Reading the design…</h3>
          <p className="analysis-hint">Reading metal, setting, stone, and band profile.</p>
        </header>
        <div className="analysis-columns">
          <div className="analysis-column analysis-column--customer">
            <ul className="analysis-grid analysis-grid--loading">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="analysis-row analysis-row--loading">
                  <span className="analysis-row-key" />
                  <span className="analysis-row-value" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  if (error && !result) {
    return (
      <section className="analysis analysis--error" id="design-analysis">
        {analysedVisual}
        <header className="analysis-header">
          <p className="studio-label">Design analysis</p>
          <h3 className="analysis-heading font-display studio-section-title">Analysis unavailable</h3>
          <p className="analysis-hint">{error}</p>
        </header>
        {onRetry && (
          <Button
            variant="outline"
            className="studio-cta"
            onClick={onRetry}
            icon={<IconRefresh size={16} />}
            iconPosition="start"
          >
            Try again
          </Button>
        )}
      </section>
    );
  }

  if (!result) return null;

  return (
    <section className="analysis" id="design-analysis">
      {analysedVisual}

      <header className="analysis-header">
        <p className="studio-label">Design analysis</p>
      </header>

      <div className="analysis-columns">
        <div className="analysis-column analysis-column--customer">
          <header className="analysis-column-head">
            <h3 className="analysis-heading font-display studio-section-title">Design notes</h3>
          </header>

          <ul className="analysis-grid">
            {result.attributes.map((attr) => (
              <li key={attr.key} className="analysis-row">
                <span className="analysis-row-key">{attr.title}</span>
                <span className="analysis-row-value">{attr.top}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="analysis-column analysis-column--technical">
          <header className="analysis-column-head">
            <p className="studio-label">Technical detail</p>
            <h3 className="analysis-heading font-display studio-section-title">Attribute scores</h3>
          </header>

          <div className="analysis-technical-block">
            <div className="analysis-research-groups">
              {result.attributes.map((attr) => (
                <div key={attr.key} className="analysis-research-group">
                  <p className="analysis-research-title">{attr.title}</p>
                  <ol className="analysis-research-list">
                    {attr.candidates.slice(0, 3).map((c, i) => (
                      <li key={c.label}>
                        <span className="analysis-research-rank">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="analysis-research-label">{c.label}</span>
                        <Meter value={c.score} />
                        <span className="analysis-research-score tabular">{c.score.toFixed(3)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Meter({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="analysis-meter">
      <div className="analysis-meter-bar" style={{ width: `${pct}%` }} />
    </div>
  );
}
