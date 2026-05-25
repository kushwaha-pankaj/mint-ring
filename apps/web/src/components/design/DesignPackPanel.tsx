"use client";

import { useState } from "react";
import {
  buildBriefSentence,
  estimatedSpecRows,
  type DesignBrief,
  type DesignPackState,
  type PackStage,
} from "@/lib/design-brief";
import { DesignPackTechnical } from "./DesignPackTechnical";

const TABS = ["Overview", "Details", "Specifications", "Inspiration"] as const;
type Tab = (typeof TABS)[number];

const CATALOGUE_URL = "https://www.hockleymint.co.uk";

function PackFrame({
  label,
  src,
  loading,
  variant,
  tint,
  badge,
}: {
  label: string;
  src?: string;
  loading?: boolean;
  variant?: "sketch" | "hero" | "angle" | "light";
  tint?: "studio" | "bright" | "day" | "warm" | "dark";
  badge?: string;
}) {
  return (
    <figure
      className={`ds-frame ds-frame--${variant ?? "angle"} ${
        loading ? "ds-frame--loading" : ""
      } ${tint ? `ds-frame--${tint}` : ""}`}
    >
      {badge && !loading && <span className="ds-frame-badge">{badge}</span>}
      {src && !loading && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="ds-frame-img" />
      )}
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function DesignPackPanel({
  brief,
  pack,
  generating,
  hasBrief,
  onRegenerate,
  onStartOver,
  onImprove,
}: {
  brief: DesignBrief;
  pack: DesignPackState | null;
  generating: boolean;
  hasBrief: boolean;
  onRegenerate: () => void;
  onStartOver: () => void;
  onImprove: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Overview");

  const empty = !pack && !generating;
  const assets = pack?.assets;
  const stages = pack?.stages ?? {
    sketch: false,
    hero: false,
    mesh: false,
    angles: false,
    lighting: false,
    spec: false,
  };
  const stageReady = (s: PackStage) => stages[s] || (!generating && pack !== null);
  const sentence = buildBriefSentence(brief);
  const downloadUrl = assets?.renderUrl;

  return (
    <aside className="ds-pack-panel" aria-labelledby="ds-pack-heading">
      <header className="ds-pack-panel-head">
        <div>
          <p className="studio-label">Your design pack</p>
          <h2 id="ds-pack-heading" className="ds-pack-panel-title">
            {pack ? pack.designId : "Design pack"}
          </h2>
        </div>
      </header>

      <div className="ds-pack-panel-body">
        <div className="ds-pack-main">
          <div className="ds-tabs" role="tablist" aria-label="Design pack views">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={`ds-tab ${tab === t ? "ds-tab--active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {empty && (
            <div className="ds-pack-empty">
              <div className="ds-pack-empty-grid" aria-hidden>
                <span />
                <span />
                <span />
                <span />
              </div>
              <p className="ds-pack-empty-title">Your pack will appear here</p>
              <p className="ds-pack-empty-hint">
                {hasBrief
                  ? "Press Generate my design to create a sketch, 3D-style render, and specification summary."
                  : "Choose a ring type, metal, and setting on the left, then generate your pack."}
              </p>
            </div>
          )}

          {!empty && tab === "Overview" && (
            <div className="ds-tab-panel" role="tabpanel">
              {(generating || stageReady("hero")) && (
                <div className="ds-pack-duo">
                  <PackFrame
                    label="Concept sketch"
                    src={assets?.sketchUrl}
                    loading={generating && !stages.sketch}
                    variant="sketch"
                  />
                  <PackFrame
                    label="Realistic 3D-style render"
                    src={assets?.renderUrl}
                    loading={generating && !stages.hero}
                    variant="hero"
                    badge="Studio render"
                  />
                </div>
              )}

              {(generating || stageReady("angles")) && (
                <div className="ds-pack-row">
                  <p className="ds-pack-row-label">Different angle views</p>
                  <div className="ds-carousel">
                    {assets?.angleUrls.map((a) => (
                      <PackFrame
                        key={a.label}
                        label={a.label}
                        src={a.url}
                        loading={generating && !stages.angles}
                        variant="angle"
                      />
                    ))}
                  </div>
                </div>
              )}

              {(generating || stageReady("lighting")) && (
                <div className="ds-pack-row">
                  <p className="ds-pack-row-label">Lighting variations</p>
                  <div className="ds-carousel">
                    {assets?.lightingUrls.map((l) => (
                      <PackFrame
                        key={l.label}
                        label={l.label}
                        src={l.url}
                        loading={generating && !stages.lighting}
                        variant="light"
                        tint={l.tint}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!empty && tab === "Details" && assets && (
            <div className="ds-tab-panel" role="tabpanel">
              <blockquote className="ds-pack-quote">
                <p>{sentence}</p>
              </blockquote>
              <div className="ds-pack-duo ds-pack-duo--spaced">
                <PackFrame label="Concept sketch" src={assets.sketchUrl} variant="sketch" />
                <PackFrame
                  label="Realistic 3D-style render"
                  src={assets.renderUrl}
                  variant="hero"
                />
              </div>
            </div>
          )}

          {!empty && tab === "Specifications" && (
            <div className="ds-tab-panel" role="tabpanel">
              <p className="ds-spec-disclaimer">
                Estimated specifications for design direction only, not manufacturing
                or CAD measurements.
              </p>
              {generating && !stages.spec ? (
                <ul className="analysis-grid analysis-grid--loading">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <li key={i} className="analysis-row analysis-row--loading">
                      <span className="analysis-row-key" />
                      <span className="analysis-row-value" />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="analysis-grid ds-spec-grid">
                  {estimatedSpecRows(brief).map((row) => (
                    <li key={row.key} className="analysis-row">
                      <span className="analysis-row-key">{row.key}</span>
                      <span className="analysis-row-value">{row.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!empty && tab === "Inspiration" && pack && (
            <div className="ds-tab-panel" role="tabpanel">
              <p className="ds-inspiration-lead">
                Prompt templates used for this demo pack. Keep these with the brief for review.
              </p>
              <DesignPackTechnical
                prompt={pack.prompt}
                sketchPrompt={pack.sketchPrompt}
                latencyMs={pack.latencyMs}
              />
              <a
                href={CATALOGUE_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-outline ds-catalogue-link"
              >
                Browse Hockley Mint catalogue
              </a>
            </div>
          )}
        </div>

        <div className="ds-pack-sidebar">
          <p className="ds-pack-sidebar-label">Next steps</p>
          <button type="button" className="btn-primary ds-sidebar-cta" disabled>
            Try this ring on
          </button>
          <button type="button" className="btn-ghost ds-sidebar-btn" onClick={onImprove}>
            Improve this design
          </button>
          <button
            type="button"
            className="btn-ghost ds-sidebar-btn"
            onClick={onRegenerate}
            disabled={!hasBrief || generating}
          >
            Create variation
          </button>
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download="hockley-mint-design-render.jpg"
              className="btn-ghost ds-sidebar-btn"
            >
              Download design pack
            </a>
          ) : (
            <button type="button" className="btn-ghost ds-sidebar-btn" disabled>
              Download design pack
            </button>
          )}
          {pack && !generating && (
            <button type="button" className="btn-ghost ds-sidebar-btn ds-sidebar-btn--muted" onClick={onStartOver}>
              New brief
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
