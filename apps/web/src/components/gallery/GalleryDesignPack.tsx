"use client";

import { useState } from "react";
import { DesignImageZoom } from "@/components/design/DesignImageZoom";
import { TurntableViewer, type TurntableFrame } from "@/components/design/TurntableViewer";
import {
  galleryAssetUrl,
  imageCount,
  sectionAssets,
  sectionSpecRows,
  type GalleryDesign,
} from "@/lib/design-gallery-api";

const SPEC_LABELS: Record<string, string> = {
  "Ring type": "Ring Type",
  Metal: "Metal",
  Setting: "Setting Style",
  "Centre stone": "Centre Stone",
  "Band style": "Band Style",
  Finish: "Finish",
  "Style mood": "Style Mood",
};

function formatWhen(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts * 1000));
  } catch {
    return "";
  }
}

function TryOnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 13V6a1.5 1.5 0 013 0v5M11 11V5a1.5 1.5 0 013 0v6M14 12V7a1.5 1.5 0 013 0v7c0 4-2.5 6-6 6H9c-2 0-3.5-1-4.5-3L3 14a1.7 1.7 0 013-1l2 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpecIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.1" strokeDasharray="2 2" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 7.5v3.5M8 5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function GalleryDesignPack({
  design,
  index,
  onLightbox,
}: {
  design: GalleryDesign;
  index: number;
  onLightbox: (url: string, label: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const sketchUrl = sectionAssets(design, "sketch")[0];
  const heroUrl = sectionAssets(design, "hero")[0];
  const angleItems = sectionAssets(design, "angles");
  const lightItems = sectionAssets(design, "lighting");
  const meshItem = sectionAssets(design, "mesh")[0];
  const specRows = sectionSpecRows(design).map((r) => ({
    key: SPEC_LABELS[r.key] ?? r.key,
    value: r.value,
  }));

  const turntableFrames: TurntableFrame[] = angleItems
    .map((a) => ({
      label: a.caption,
      degrees: a.degrees ?? 0,
      url: galleryAssetUrl(a.url),
    }))
    .sort((a, b) => a.degrees - b.degrees);

  const heroSrc = heroUrl ? galleryAssetUrl(heroUrl.url) : undefined;
  const sketchSrc = sketchUrl ? galleryAssetUrl(sketchUrl.url) : undefined;
  const meshSrc = meshItem ? galleryAssetUrl(meshItem.url) : undefined;
  const tryOnHref =
    heroSrc && meshSrc
      ? `/try-on?job_id=${encodeURIComponent(design.job_id)}`
      : null;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(design.design_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* harmless */
    }
  };

  let panelNum = 0;

  return (
    <article
      id={`pack-${design.job_id}`}
      className={`ds-results ds-gallery-pack ${index > 0 ? "ds-gallery-pack--sep" : ""}`}
      aria-labelledby={`pack-title-${design.job_id}`}
    >
      <div className="ds-results-top">
        <div className="ds-results-head">
          <div className="ds-results-heading-copy">
            <h2 id={`pack-title-${design.job_id}`} className="ds-results-title">
              {design.title.split(" · ")[0]}{" "}
              <em>{design.title.includes("·") ? design.title.split("·").slice(1).join("·").trim() : "Design Pack"}</em>
            </h2>
            <p>
              Generated {formatWhen(design.created_at)} · {imageCount(design)} images saved on
              this device.
            </p>
          </div>

          <div className="ds-results-id-pill">
            <span>Design ID: {design.design_id}</span>
            <button type="button" onClick={() => void copyId()} aria-label="Copy design ID">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M8 8h10v12H8zM6 16H4V4h10v2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {copied && <small>Copied</small>}
          </div>

          <div className="ds-results-actions">
            <a href={design.href} className="ds-results-action">
              Open in Design
            </a>
            {tryOnHref ? (
              <a href={tryOnHref} className="ds-results-action ds-results-action--primary">
                Try on
              </a>
            ) : (
              <button
                type="button"
                className="ds-results-action"
                disabled
                aria-disabled="true"
                title="Try-on needs a finished 3D mesh."
              >
                Try on
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="ds-results-layout">
        <main className="ds-results-main">
          <div className="ds-results-primary-grid">
            {sketchSrc && (
              <GalleryResultPanel
                number={++panelNum}
                title="Concept Sketch"
                variant="sketch"
                src={sketchSrc}
                onView={() => onLightbox(sketchSrc, `${design.title}: Concept Sketch`)}
              />
            )}
            {heroSrc && (
              <GalleryResultPanel
                number={++panelNum}
                title="Realistic Render"
                variant="render"
                src={heroSrc}
                onView={() => onLightbox(heroSrc, `${design.title}: Realistic Render`)}
              />
            )}
          </div>

          {turntableFrames.length > 0 && (
            <section className="ds-results-panel ds-results-panel--turntable">
              <PanelHeader
                number={++panelNum}
                title="Different angle views"
                meta={`(${turntableFrames.length} views)`}
              />
              <TurntableViewer
                frames={turntableFrames}
                loading={false}
                expectedFrameCount={turntableFrames.length}
                meshGlbUrl={meshSrc}
                meshStatus={meshSrc ? "done" : undefined}
                meshPosterUrl={heroSrc}
              />
            </section>
          )}

          {lightItems.length > 0 && (
            <section className="ds-results-panel ds-results-panel--lighting">
              <PanelHeader
                number={++panelNum}
                title="Lighting Variations"
                meta={`(${lightItems.length} styles)`}
              />
              <div className="ds-results-light-row">
                {lightItems.map((light) => {
                  const url = galleryAssetUrl(light.url);
                  return (
                    <figure
                      key={light.filename}
                      className="ds-results-light ds-results-light--studio"
                    >
                      <div className="ds-results-light-media">
                        <DesignImageZoom src={url} alt={light.caption} magnify={0.95} />
                      </div>
                      <figcaption>{light.caption}</figcaption>
                      <button
                        type="button"
                        className="ds-results-light-view"
                        onClick={() => onLightbox(url, `${design.title}: ${light.caption}`)}
                      >
                        View full size
                      </button>
                    </figure>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        <aside className="ds-results-side">
          {specRows.length > 0 && (
            <section className="ds-results-spec">
              <header className="ds-results-side-head">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M7 4h7l3 3v13H7V4zm7 0v4h4M9 12h6M9 16h4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <h3>AI Estimated Specifications</h3>
              </header>
              <ul className="ds-results-spec-list">
                {specRows.map((row, i) => (
                  <li key={`${row.key}-${i}`}>
                    <SpecIcon />
                    <span>{row.key}</span>
                    <strong>{row.value}</strong>
                  </li>
                ))}
              </ul>
              <p className="ds-results-spec-note">
                <InfoIcon /> These specifications are AI estimated, not exact manufacturing
                measurements.
              </p>
            </section>
          )}

          {meshSrc && (
            <section className="ds-results-panel ds-results-panel--mesh">
              <PanelHeader number={++panelNum} title="3D mesh" />
              <div className="ds-gallery-mesh-viewer">
                {/* @ts-expect-error model-viewer custom element */}
                <model-viewer
                  src={meshSrc}
                  alt={`3D mesh for ${design.title}`}
                  camera-controls
                  shadow-intensity="0.6"
                  exposure="1"
                  loading="lazy"
                />
              </div>
              <a href={meshSrc} className="btn-ghost ds-gallery-mesh-dl" download>
                Download GLB
              </a>
            </section>
          )}

          <section className="ds-results-next">
            <h3>What would you like to do next?</h3>
            <div className="ds-next-grid ds-next-grid--solo">
              {tryOnHref ? (
                <a href={tryOnHref} className="ds-next-card ds-next-card--enabled">
                  <TryOnIcon />
                  <span className="ds-next-card-title">Try This Ring On</span>
                  <span className="ds-next-card-hint">
                    See it on your hand with live AR and a photoreal preview.
                  </span>
                  <span className="ds-next-card-arrow" aria-hidden>
                    →
                  </span>
                </a>
              ) : (
                <button
                  type="button"
                  className="ds-next-card"
                  disabled
                  aria-disabled="true"
                  title="Try-on needs a finished 3D mesh."
                >
                  <TryOnIcon />
                  <span className="ds-next-card-title">Try This Ring On</span>
                  <span className="ds-next-card-hint">Available once the 3D mesh is ready.</span>
                  <span className="ds-next-card-arrow" aria-hidden>
                    →
                  </span>
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}

function GalleryResultPanel({
  number,
  title,
  variant,
  src,
  onView,
}: {
  number: number;
  title: string;
  variant: "sketch" | "render";
  src: string;
  onView: () => void;
}) {
  return (
    <section className={`ds-results-panel ds-results-panel--${variant}`}>
      <div className="ds-results-panel-head">
        <PanelHeader number={number} title={title} />
        <div className="ds-results-panel-actions">
          <button type="button" onClick={onView}>
            View Full Size
          </button>
        </div>
      </div>
      <div className={`ds-results-image ds-results-image--${variant} ds-results-image--paired`}>
        <DesignImageZoom
          src={src}
          alt={title}
          fit="contain"
          magnify={variant === "sketch" ? 1.05 : 1}
          zoomPosition="original"
        />
      </div>
    </section>
  );
}

function PanelHeader({
  number,
  title,
  meta,
}: {
  number: number;
  title: string;
  meta?: string;
}) {
  return (
    <h3 className="ds-results-panel-title">
      <span>{number}.</span> {title} {meta && <small>{meta}</small>}
    </h3>
  );
}
