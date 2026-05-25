"use client";

import { useCallback, useState } from "react";
import type { GenerateResponse } from "@/lib/tryon-api";
import { tryOnAssetUrl } from "@/lib/tryon-api";
import { TryOnLightbox } from "./TryOnLightbox";

type LightboxState = { url: string; label: string } | null;

export function HeroResultPanel({
  before,
  refined,
}: {
  before: string | null;
  refined: GenerateResponse | null;
}) {
  const [lightbox, setLightbox] = useState<LightboxState>(null);

  const refinedUrl = refined ? tryOnAssetUrl(refined.url) : null;

  const closeLightbox = useCallback(() => setLightbox(null), []);

  if (!refined) return null;

  return (
    <section className="ts-result-panel hm-reveal" aria-labelledby="ts-result-title">
      <h3 id="ts-result-title" className="ds-step3-panel-title">
        4. Photoreal try-on
      </h3>
      <p className="ds-step3-panel-copy">
        Compare your hand photo with the refined preview. Click any image to view full size.
      </p>

      <div className="tryon-result-grid">
        <ResultTile
          label="Your hand photo"
          imageUrl={before}
          emptyLabel="No preview"
          onView={before ? () => setLightbox({ url: before, label: "Your hand photo" }) : undefined}
        />
        <ResultTile
          label="Photoreal try-on"
          imageUrl={refinedUrl}
          variant="hero"
          onView={
            refinedUrl
              ? () => setLightbox({ url: refinedUrl, label: "Photoreal try-on" })
              : undefined
          }
        />
      </div>

      <details className="ts-result-technical">
        <summary>Technical detail</summary>
        <dl>
          <div>
            <dt>Engine</dt>
            <dd>{refined.engine}</dd>
          </div>
          <div>
            <dt>Latency</dt>
            <dd>{(refined.latency_ms / 1000).toFixed(1)} s</dd>
          </div>
          <div>
            <dt>Seed</dt>
            <dd className="tabular">{refined.seed}</dd>
          </div>
          <div>
            <dt>Render size</dt>
            <dd className="tabular">
              {refined.image_size.width} × {refined.image_size.height}
            </dd>
          </div>
        </dl>
      </details>

      {lightbox && (
        <TryOnLightbox url={lightbox.url} label={lightbox.label} onClose={closeLightbox} />
      )}
    </section>
  );
}

function ResultTile({
  label,
  imageUrl,
  emptyLabel = "No preview",
  variant,
  onView,
}: {
  label: string;
  imageUrl: string | null;
  emptyLabel?: string;
  variant?: "hero";
  onView?: () => void;
}) {
  const clickable = Boolean(imageUrl && onView);

  return (
    <figure
      className={`tryon-result-tile ${variant === "hero" ? "tryon-result-tile--hero" : ""}`}
    >
      {clickable ? (
        <button
          type="button"
          className="tryon-result-tile-btn"
          onClick={onView}
          aria-label={`View full size: ${label}`}
        >
          <span className="tryon-result-tile-frame tryon-result-tile-frame--clickable">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl!} alt={label} />
            <span className="ts-result-view-label">View full</span>
          </span>
        </button>
      ) : (
        <div className="tryon-result-tile-frame">
          <div className="tryon-result-tile-empty">{emptyLabel}</div>
        </div>
      )}
      <figcaption>{label}</figcaption>
    </figure>
  );
}
