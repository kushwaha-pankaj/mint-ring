"use client";

import { useCallback, useEffect, useState } from "react";
import { ForestCtaChevron } from "@/components/design/ForestCtaChevron";
import { GalleryDateSection } from "./GalleryDateSection";
import { GalleryPageHero } from "./GalleryPageHero";
import { ensureStudioDeviceId } from "@/lib/device-id";
import {
  fetchDeviceGallery,
  galleryGroupsFromResponse,
  type GalleryResponse,
  GalleryApiError,
} from "@/lib/design-gallery-api";

type Lightbox = { url: string; label: string } | null;

export function GalleryView() {
  const [data, setData] = useState<GalleryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Lightbox>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatusLine(null);
    try {
      await ensureStudioDeviceId();
      const res = await fetchDeviceGallery((attempt) => {
        if (attempt > 0) {
          setStatusLine("Studio server is starting. Retrying…");
        }
      });
      setData(res);
    } catch (e) {
      setData(null);
      setError(
        e instanceof GalleryApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not load your gallery.",
      );
    } finally {
      setLoading(false);
      setStatusLine(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && error && !loading) {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [error, loading, load]);

  if (loading) {
    return (
      <>
        <GalleryPageHero rangeLabel={null} />
        <section className="studio ds-studio">
          <div className="studio-sheet studio-sheet--overlap ds-sheet">
            <div className="ds-gallery-state">
              <p className="ds-gallery-state-copy">
                {statusLine ?? "Loading studio archive…"}
              </p>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (error) {
    return (
      <>
        <GalleryPageHero rangeLabel={null} />
        <section className="studio ds-studio">
          <div className="studio-sheet studio-sheet--overlap ds-sheet">
      <div className="ds-results-banner ds-results-banner--error" role="alert">
        <div>
          <strong>Could not load the gallery.</strong>
          <p>{error}</p>
        </div>
        <div className="ds-results-banner-actions">
          <button type="button" className="btn-primary" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </div>
          </div>
        </section>
      </>
    );
  }

  if (!data || data.designs.length === 0) {
    return (
      <>
        <GalleryPageHero rangeLabel={null} />
        <section className="studio ds-studio">
          <div className="studio-sheet studio-sheet--overlap ds-sheet">
      <div className="ds-gallery-empty">
        <h2 className="ds-results-title">
          Your <em>gallery</em> is empty
        </h2>
        <p className="ds-gallery-empty-copy">
          Generate a design pack on Design and it will appear here automatically for this
          computer.
        </p>
        <a href="/design" className="ds-forest-cta">
          Start a design
          <ForestCtaChevron />
        </a>
      </div>
          </div>
        </section>
      </>
    );
  }

  const groups = galleryGroupsFromResponse(data);

  return (
    <>
      <GalleryPageHero rangeLabel={data.range_label} packCount={data.design_count} />

      <section className="studio ds-studio" aria-label="Saved design packs by date">
        <div className="studio-sheet studio-sheet--overlap ds-sheet">
          <div className="ds-gallery-sheet-inner">
        {groups.map((group) => (
          <GalleryDateSection
            key={group.date_key}
            group={group}
            onLightbox={(url, label) => setLightbox({ url, label })}
          />
        ))}

        <section className="ds-results-start-over" aria-label="Create another design">
          <a href="/design" className="ds-forest-cta">
            Create another design
            <ForestCtaChevron />
          </a>
        </section>
          </div>
        </div>
      </section>

      {lightbox && (
        <div
          className="ds-lightbox"
          role="dialog"
          aria-modal
          aria-label={`Full size preview: ${lightbox.label}`}
          onClick={() => setLightbox(null)}
          onKeyDown={(e) => e.key === "Escape" && setLightbox(null)}
        >
          <figure className="ds-lightbox-figure" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={lightbox.label} />
            <figcaption>{lightbox.label}</figcaption>
          </figure>
          <button type="button" className="ds-lightbox-close" onClick={() => setLightbox(null)}>
            Close
          </button>
        </div>
      )}
    </>
  );
}
