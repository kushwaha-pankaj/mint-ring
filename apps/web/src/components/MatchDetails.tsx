"use client";

import { useEffect, useState } from "react";
import {
  getHealth,
  type DetectionMeta,
  type HealthResult,
  type IdentifyResult,
} from "@/lib/api";
import { ringFromSku } from "@/lib/catalogue";

/**
 * Technical panel: scores, encoder, neighbours, detection facts.
 * Standalone section or embedded in the design analysis technical column.
 */
export function MatchDetails({
  result,
  detection,
  variant = "standalone",
}: {
  result: IdentifyResult;
  detection?: DetectionMeta;
  /** standalone: full section; column: subsection inside design analysis */
  variant?: "standalone" | "column";
}) {
  const [health, setHealth] = useState<HealthResult | null>(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, []);

  const body = (
    <>
      {variant === "standalone" && (
        <header className="match-research-head">
          <p className="studio-label">Technical detail</p>
          <h3 className="match-research-title font-display studio-section-title">
            Identification &amp; detection metrics
          </h3>
        </header>
      )}

      {variant === "column" && (
        <p className="studio-label analysis-technical-subhead">Identification &amp; detection</p>
      )}

      <div className="match-research-body">
        <div className="match-research-stats">
          <Stat label="Latency" value={`${result.latency_ms} ms`} />
          <Stat label="Threshold" value={`${Math.round(result.threshold * 100)}%`} />
          <Stat
            label={result.is_confident ? "Accepted cosine" : "Best raw cosine"}
            value={result.confidence.toFixed(3)}
          />
          <Stat label="Top-k" value={`${result.top_k_requested}`} />
          <Stat label="Encoder" value={health?.encoder ?? "n/a"} />
          <Stat label="Gallery size" value={health ? `${health.gallery_size}` : "n/a"} />
          <Stat label="Classes" value={health ? `${health.classes.length}` : "n/a"} />
          <Stat label="Boot" value={health ? `${health.boot_seconds}s` : "n/a"} />
          <Stat
            label="Predicted"
            value={result.predicted_class}
          />
          <Stat
            label="Confident?"
            value={result.is_confident ? "Yes" : "No"}
          />
        </div>

        {detection && (
          <div className="match-research-detection">
            <span className="studio-label">Detection</span>
            <div className="match-research-stats">
              <Stat
                label="Status"
                value={detection.applied ? "Applied" : "Skipped (no hand)"}
              />
              <Stat label="Finger" value={detection.finger ?? "n/a"} />
              <Stat label="Hand" value={detection.handedness ?? "n/a"} />
              <Stat
                label="Bbox (x,y,w,h)"
                value={
                  detection.bbox
                    ? detection.bbox.map((n) => Math.round(n)).join(", ")
                    : "n/a"
                }
              />
              <Stat label="Detector latency" value={`${detection.latencyMs} ms`} />
              <Stat label="Method" value={detection.method} />
            </div>
          </div>
        )}

        <div className="match-research-neighbours">
          <span className="studio-label">
            Threshold-qualified neighbours ({result.top_k.length})
          </span>
          <ol className="match-research-list">
            {result.top_k.map((m, i) => {
              const r = ringFromSku(m.label);
              return (
                <li key={i}>
                  <span className="match-research-rank">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="match-research-sku">{m.label}</span>
                  <span className="match-research-meta">
                    {r.name}, {r.subtitle}
                  </span>
                  <SimilarityBar value={m.similarity} />
                  <span className="match-research-score">
                    {m.similarity.toFixed(3)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="match-research-note">
          Cosine similarity is computed as the dot product of L2-normalised
          image embeddings. The shortlist only contains reference images whose
          similarity is greater than or equal to the active operator threshold.
        </p>
      </div>
    </>
  );

  if (variant === "column") {
    return (
      <div className="analysis-technical-block analysis-technical-block--ident" aria-label="Identification and detection metrics">
        {body}
      </div>
    );
  }

  return (
    <section className="match-research match-research--open" aria-label="Technical detail">
      {body}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="match-research-stat">
      <div className="match-research-stat-label">{label}</div>
      <div className="match-research-stat-value">{value}</div>
    </div>
  );
}

function SimilarityBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="match-research-bar">
      <div className="match-research-bar-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
