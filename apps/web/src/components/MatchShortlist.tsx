"use client";

import { useState } from "react";
import type { ClassScore, IdentifyMatch, IdentifyResult } from "@/lib/api";
import { ringFromSku, metalLabel, metalSwatch } from "@/lib/catalogue";
import { RingThumb } from "./RingThumb";

/**
 * Ranked shortlist of threshold-qualified catalogue references.
 *
 * Two stacked sections:
 *   1. Per-design aggregate (what the model would vote for as "the match")
 *      — sorted desc by mean cosine, each row shows similarity score.
 *   2. Per-image neighbours — the raw top-K reference photos with thumbnails.
 *
 * The API filters this list by the active confidence threshold, so rows here
 * are accepted matches only. Below-threshold neighbours stay out of the UI.
 */
export function MatchShortlist({
  result,
  embedded = false,
}: {
  result: IdentifyResult;
  /** embedded: no outer card — section inside .match-rank-panel */
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<"designs" | "photos">("designs");
  const thresholdPct = Math.round(result.threshold * 100);
  const acceptedCount = result.top_k.length;
  const rootClass = [
    "match-shortlist",
    "font-display",
    embedded && "match-shortlist--embedded",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={rootClass} aria-label="Closest catalogue matches">
      <header className="match-shortlist__head font-display">
        <div>
          <p className="studio-label">Closest catalogue matches</p>
          <h3 className="match-shortlist__title">
            {acceptedCount > 0
              ? `${acceptedCount} catalogue match${acceptedCount === 1 ? "" : "es"} above ${thresholdPct}%`
              : `No catalogue matches above ${thresholdPct}%`}
          </h3>
        </div>
        <ConfidenceBadge result={result} />
      </header>

      <div className="match-shortlist__tabs" role="tablist" aria-label="Shortlist view">
        <ShortlistTab active={tab === "designs"} onClick={() => setTab("designs")}>
          By design ({result.class_scores.length})
        </ShortlistTab>
        <ShortlistTab active={tab === "photos"} onClick={() => setTab("photos")}>
          By reference photo ({result.top_k.length})
        </ShortlistTab>
      </div>

      {tab === "designs" && result.class_scores.length === 0 && (
        <EmptyShortlist thresholdPct={thresholdPct} />
      )}

      {tab === "photos" && result.top_k.length === 0 && (
        <EmptyShortlist thresholdPct={thresholdPct} />
      )}

      {tab === "designs" && result.class_scores.length > 0 ? (
        <ol className="match-shortlist__designs">
          {result.class_scores.map((score, idx) => (
            <DesignRow
              key={score.label}
              score={score}
              rank={idx + 1}
              isTop={idx === 0}
              topPhoto={result.top_k.find((m) => m.label === score.label)?.source_path}
            />
          ))}
        </ol>
      ) : tab === "photos" && result.top_k.length > 0 ? (
        <ol className="match-shortlist__photos">
          {result.top_k.map((m, idx) => (
            <PhotoRow key={`${m.source_path}-${idx}`} match={m} rank={idx + 1} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ShortlistTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? "match-shortlist__tab match-shortlist__tab--on" : "match-shortlist__tab"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DesignRow({
  score,
  rank,
  isTop,
  topPhoto,
}: {
  score: ClassScore;
  rank: number;
  isTop: boolean;
  topPhoto?: string;
}) {
  const meta = ringFromSku(score.label);
  const pct = Math.round(score.mean_similarity * 100);

  return (
    <li className={`match-row ${isTop ? "match-row--top" : ""}`}>
      <span className="match-row__rank">{String(rank).padStart(2, "0")}</span>
      <div className="match-row__thumb">
        <RingThumb refPath={topPhoto} alt={meta.name} size="md" fill />
      </div>
      <div className="match-row__copy">
        <div className="match-row__name-line">
          <span className="match-row__name">{meta.name}</span>
          <span className="match-row__sku">{meta.sku}</span>
        </div>
        <p className="match-row__subtitle">
          <MetalDot metal={meta.metal} />
          {meta.subtitle}
          <span className="match-row__count">· {score.count} neighbour{score.count === 1 ? "" : "s"}</span>
        </p>
      </div>
      <div className="match-row__score">
        <div className="match-row__bar" aria-hidden>
          <div className="match-row__bar-fill match-row__bar-fill--ok" style={{ width: `${pct}%` }} />
        </div>
        <div className="match-row__pct">
          <strong>{pct}%</strong>
          <span className="match-row__chip match-row__chip--ok">Similarity</span>
        </div>
      </div>
    </li>
  );
}

function PhotoRow({ match, rank }: { match: IdentifyMatch; rank: number }) {
  const meta = ringFromSku(match.label);
  const pct = Math.round(match.similarity * 100);

  return (
    <li className={`match-row match-row--photo ${rank === 1 ? "match-row--top" : ""}`}>
      <span className="match-row__rank">{String(rank).padStart(2, "0")}</span>
      <div className="match-row__thumb">
        <RingThumb refPath={match.source_path} alt={meta.name} size="md" fill />
      </div>
      <div className="match-row__copy">
        <div className="match-row__name-line">
          <span className="match-row__name">{meta.name}</span>
          <span className="match-row__sku">{meta.sku}</span>
        </div>
        <p className="match-row__subtitle">
          <MetalDot metal={meta.metal} />
          {meta.subtitle}
        </p>
      </div>
      <div className="match-row__score">
        <div className="match-row__bar" aria-hidden>
          <div className="match-row__bar-fill match-row__bar-fill--ok" style={{ width: `${pct}%` }} />
        </div>
        <div className="match-row__pct">
          <strong>{pct}%</strong>
          <span className="match-row__chip match-row__chip--ok">Similarity</span>
        </div>
      </div>
    </li>
  );
}

function EmptyShortlist({ thresholdPct }: { thresholdPct: number }) {
  return (
    <p className="match-shortlist__empty">
      No reference image passed the active {thresholdPct}% confidence threshold.
    </p>
  );
}

function ConfidenceBadge({ result }: { result: IdentifyResult }) {
  if (!result.is_confident) {
    return (
      <span className="confidence-badge confidence-badge--empty">
        <span className="confidence-badge__dot" aria-hidden />
        0 above {Math.round(result.threshold * 100)}%
      </span>
    );
  }

  const pct = Math.round(result.confidence * 100);
  return (
    <span className="confidence-badge confidence-badge--ok">
      <span className="confidence-badge__dot" aria-hidden />
      Similarity {pct}%
    </span>
  );
}

function MetalDot({ metal }: { metal: ReturnType<typeof ringFromSku>["metal"] }) {
  return (
    <span
      className="match-metal"
      style={{ background: metalSwatch(metal) }}
      title={metalLabel(metal)}
      aria-hidden
    />
  );
}
