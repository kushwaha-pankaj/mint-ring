"use client";

import { useEffect, useState } from "react";
import type { RingSource } from "@/lib/tryon-ring-source";
import { SegmentButton, SegmentGroup } from "@/components/ui";
import { TryOnMeshViewer } from "./TryOnMeshViewer";

type View = "render" | "mesh";

export function TryOnRingPanel({
  ring,
  loading,
}: {
  ring: RingSource | null;
  loading: boolean;
}) {
  const [view, setView] = useState<View>("render");

  useEffect(() => {
    if (ring?.meshUrl) setView("mesh");
  }, [ring?.meshUrl]);

  if (loading) {
    return (
      <section className="ts-ring-panel" aria-labelledby="ts-ring-panel-title" aria-busy="true">
        <h2 id="ts-ring-panel-title" className="ts-ring-panel-title">
          Your design
        </h2>
        <div className="ts-ring-preview ts-ring-preview--skeleton" aria-hidden />
        <p className="ts-ring-panel-status">Loading design pack…</p>
      </section>
    );
  }

  if (!ring) {
    return (
      <section
        className="ts-ring-panel ts-ring-panel--empty"
        aria-labelledby="ts-ring-panel-title"
      >
        <h2 id="ts-ring-panel-title" className="ts-ring-panel-title">
          Your design
        </h2>
        <p className="ts-ring-panel-lead">
          Generate a design pack in Design, then return here to try it on.
        </p>
        <a href="/design?from=tryon" className="ds-forest-cta ts-ring-panel-cta">
          Design a ring
        </a>
      </section>
    );
  }

  const hasMesh = Boolean(ring.meshUrl);
  const activeView: View = view === "mesh" && hasMesh ? "mesh" : "render";

  return (
    <section className="ts-ring-panel" aria-labelledby="ts-ring-panel-title">
      <header className="ts-ring-panel-head">
        <h2 id="ts-ring-panel-title" className="ts-ring-panel-title">
          Your design
        </h2>
        <p className="ts-ring-panel-meta">
          <span className="ts-ring-panel-id">{ring.designId}</span>
        </p>
      </header>

      <SegmentGroup
        className="ts-ring-view-tabs"
        role="tablist"
        aria-label="Ring preview mode"
        size="md"
      >
        <SegmentButton
          role="tab"
          aria-selected={activeView === "render"}
          active={activeView === "render"}
          size="md"
          className="ts-ring-view-tab"
          onClick={() => setView("render")}
        >
          2D render
        </SegmentButton>
        <SegmentButton
          role="tab"
          aria-selected={activeView === "mesh"}
          active={activeView === "mesh"}
          size="md"
          className="ts-ring-view-tab"
          onClick={() => setView("mesh")}
          disabled={!hasMesh}
          title={
            hasMesh
              ? undefined
              : "Enable the 3D mesh stage in Design to preview and use Live AR."
          }
        >
          3D mesh
        </SegmentButton>
      </SegmentGroup>

      <div className="ts-ring-preview-block">
        <figure className="ts-ring-preview">
          {activeView === "render" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ring.ringImageUrl}
              alt="Hero render from your design pack"
              className="ts-ring-preview-media"
            />
          ) : ring.meshUrl ? (
            <TryOnMeshViewer
              glbUrl={ring.meshUrl}
              posterUrl={ring.ringImageUrl}
              title={`3D mesh for design ${ring.designId}`}
              className="ts-ring-preview-media ts-ring-preview-media--mesh"
            />
          ) : null}
          <figcaption className="ts-ring-preview-caption">
            {activeView === "render"
              ? "Hero render for photoreal try-on"
              : "Orbit to inspect · powers Live AR"}
          </figcaption>
        </figure>
      </div>

      <footer className="ts-ring-panel-foot">
        <a
          href={`/design?job_id=${encodeURIComponent(ring.jobId)}`}
          className="ts-ring-panel-link"
        >
          Design pack
        </a>
        {ring.meshUrl ? (
          <a href={ring.meshUrl} className="ts-ring-panel-link" download>
            GLB
          </a>
        ) : (
          <span className="ts-ring-panel-hint">Mesh off</span>
        )}
      </footer>
    </section>
  );
}
