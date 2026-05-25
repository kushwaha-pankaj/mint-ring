"use client";

import type { GalleryDateGroup } from "@/lib/design-gallery-api";
import { galleryAssetUrl } from "@/lib/design-gallery-api";
import { GalleryDesignPack } from "./GalleryDesignPack";

type Props = {
  group: GalleryDateGroup;
  onLightbox: (url: string, label: string) => void;
};

export function GalleryDateSection({ group, onLightbox }: Props) {
  const headingId = `gallery-date-${group.date_key}`;

  return (
    <section
      className="ds-gallery-date-group"
      aria-labelledby={headingId}
    >
      <header className="ds-gallery-date-head">
        <h2 id={headingId} className="ds-gallery-date-title">
          {group.date_label}
        </h2>
        <p className="ds-gallery-date-meta">
          {group.design_count === 0
            ? null
            : `${group.design_count} design pack${group.design_count === 1 ? "" : "s"}`}
          {group.design_count > 0 && group.tryon_count > 0 ? " · " : null}
          {group.tryon_count > 0
            ? `${group.tryon_count} try-on${group.tryon_count === 1 ? "" : "s"}`
            : null}
        </p>
      </header>

      {group.designs.map((design, index) => (
        <GalleryDesignPack
          key={design.job_id}
          design={design}
          index={index}
          onLightbox={onLightbox}
        />
      ))}

      {group.tryons.length > 0 && (
        <section className="ds-results-panel ds-gallery-tryons">
          <h3 className="ds-results-panel-title">
            <span>+</span> Photoreal try-ons
          </h3>
          <div className="ds-results-light-row">
            {group.tryons.map((t) => {
              const url = galleryAssetUrl(t.url);
              return (
                <figure
                  key={t.render_id}
                  className="ds-results-light ds-results-light--studio"
                >
                  <div className="ds-results-light-media">
                    <button
                      type="button"
                      className="ds-gallery-tryon-thumb"
                      onClick={() => onLightbox(url, t.title)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" />
                    </button>
                  </div>
                  <figcaption>{t.title}</figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}
