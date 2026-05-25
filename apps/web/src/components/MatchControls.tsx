"use client";

import { useId, type CSSProperties } from "react";

export const MATCH_THRESHOLD_MIN = 0.2;
export const MATCH_THRESHOLD_MAX = 0.99;
export const MATCH_THRESHOLD_STEP = 0.01;
export const MATCH_THRESHOLD_DEFAULT = 0.9;

export const MATCH_TOPK_MIN = 1;
export const MATCH_TOPK_MAX = 10;
export const MATCH_TOPK_DEFAULT = 5;

/**
 * Operator-facing controls for the identification pass. The threshold is the
 * cosine-similarity cutoff the operator uses to confirm a match,
 * and the shortlist size sets how many nearest catalogue neighbours we ask
 * the API to return.
 *
 * Both values are committed live: changing them re-runs identification on
 * the current photograph, so the panel sees confidence and ranking shift
 * in real time. The controls are mirrored across the input strip and the
 * shortlist header so the operator can adjust from wherever they are
 * looking.
 */
export function MatchControls({
  threshold,
  topK,
  onThresholdChange,
  onTopKChange,
  disabled = false,
  variant = "panel",
  embedded = false,
  className = "",
}: {
  threshold: number;
  topK: number;
  onThresholdChange: (next: number) => void;
  onTopKChange: (next: number) => void;
  disabled?: boolean;
  /** panel: full card with eyebrow; inline: compact row to embed in headers */
  variant?: "panel" | "inline";
  /** embedded: no outer card chrome — lives inside .match-rank-panel */
  embedded?: boolean;
  className?: string;
}) {
  const thresholdId = useId();
  const topKId = useId();
  const thresholdPct = Math.round(threshold * 100);
  const thresholdFill =
    ((threshold - MATCH_THRESHOLD_MIN) / (MATCH_THRESHOLD_MAX - MATCH_THRESHOLD_MIN)) *
    100;
  const topKFill =
    ((topK - MATCH_TOPK_MIN) / (MATCH_TOPK_MAX - MATCH_TOPK_MIN)) * 100;

  const body = (
    <div className="match-controls__body">
      <div className="match-controls__field">
        <div className="match-controls__field-head">
          <label htmlFor={thresholdId} className="match-controls__label">
            Confidence threshold
          </label>
          <span className="match-controls__value" aria-live="polite">
            {thresholdPct}%
          </span>
        </div>
        <div className="match-controls__slider-row">
          <input
            id={thresholdId}
            type="range"
            min={MATCH_THRESHOLD_MIN}
            max={MATCH_THRESHOLD_MAX}
            step={MATCH_THRESHOLD_STEP}
            value={threshold}
            disabled={disabled}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="match-controls__range"
            style={{ "--match-fill": `${thresholdFill}%` } as CSSProperties}
            aria-describedby={`${thresholdId}-hint`}
          />
        </div>
        <div className="match-controls__scale" aria-hidden>
          <span>{Math.round(MATCH_THRESHOLD_MIN * 100)}%</span>
          <span>{Math.round(MATCH_THRESHOLD_MAX * 100)}%</span>
        </div>
        <p id={`${thresholdId}-hint`} className="match-controls__hint">
          Sets the minimum score required for a catalogue match to appear in the
          result card and shortlist.
        </p>
      </div>

      <div className="match-controls__field">
        <div className="match-controls__field-head">
          <label htmlFor={topKId} className="match-controls__label">
            Matches to show
          </label>
          <span className="match-controls__value" aria-live="polite">
            {topK}
          </span>
        </div>
        <div
          className="match-controls__slider-row match-controls__slider-row--stepped"
          role="group"
          aria-labelledby={topKId}
        >
          <button
            type="button"
            className="match-controls__step"
            disabled={disabled || topK <= MATCH_TOPK_MIN}
            aria-label="Show one fewer match"
            onClick={() => onTopKChange(Math.max(MATCH_TOPK_MIN, topK - 1))}
          >
            &minus;
          </button>
          <input
            id={topKId}
            type="range"
            min={MATCH_TOPK_MIN}
            max={MATCH_TOPK_MAX}
            step={1}
            value={topK}
            disabled={disabled}
            onChange={(e) => onTopKChange(Number(e.target.value))}
            className="match-controls__range"
            style={{ "--match-fill": `${topKFill}%` } as CSSProperties}
            aria-describedby={`${topKId}-hint`}
          />
          <button
            type="button"
            className="match-controls__step"
            disabled={disabled || topK >= MATCH_TOPK_MAX}
            aria-label="Show one more match"
            onClick={() => onTopKChange(Math.min(MATCH_TOPK_MAX, topK + 1))}
          >
            +
          </button>
        </div>
        <div className="match-controls__scale" aria-hidden>
          <span>{MATCH_TOPK_MIN}</span>
          <span>{MATCH_TOPK_MAX}</span>
        </div>
        <p id={`${topKId}-hint`} className="match-controls__hint">
          We rank the closest {topK} catalogue references and aggregate per design.
        </p>
      </div>
    </div>
  );

  const rootClass = [
    "match-controls",
    embedded && "match-controls--embedded",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "inline") {
    return (
      <section className={`${rootClass} match-controls--inline`} aria-label="Match controls">
        {body}
      </section>
    );
  }

  return (
    <section className={rootClass} aria-label="Match controls">
      <header className="match-controls__head">
        <p className="studio-label">Match settings</p>
        <h3 className="match-controls__title">Tune confidence &amp; shortlist</h3>
      </header>
      {body}
    </section>
  );
}
