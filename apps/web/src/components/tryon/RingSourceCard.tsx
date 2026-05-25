"use client";

import type { RingSource } from "@/lib/tryon-ring-source";

export function RingSourceCard({
  ring,
  loading,
}: {
  ring: RingSource | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <aside className="ds-sidebar-card ds-sidebar-card--tryon" aria-labelledby="ts-ring-heading">
        <p className="thread">Step 1</p>
        <h2 id="ts-ring-heading" className="ds-sidebar-title">
          Your ring
        </h2>
        <div className="tryon-ring-card-skeleton" aria-hidden />
        <p className="ds-sidebar-body tryon-ring-card-status">Loading your latest design pack…</p>
      </aside>
    );
  }

  if (!ring) {
    return (
      <aside
        className="ds-sidebar-card ds-sidebar-card--tryon ds-sidebar-card--tryon-empty"
        aria-labelledby="ts-ring-heading"
      >
        <p className="thread">Step 1</p>
        <h2 id="ts-ring-heading" className="ds-sidebar-title">
          Your ring
        </h2>
        <div className="ts-ring-empty-preview" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/design/hero-ring-sketch.svg" alt="" className="ts-ring-empty-art" />
        </div>
        <p className="ds-sidebar-body">
          Try-on needs a finished hero render from Design. Generate a design pack first, then
          return here.
        </p>
        <a href="/design" className="ds-forest-cta ts-ring-empty-cta">
          Design a ring
        </a>
      </aside>
    );
  }

  return (
    <aside className="ds-sidebar-card ds-sidebar-card--tryon" aria-labelledby="ts-ring-heading">
      <p className="thread">Step 1</p>
      <h2 id="ts-ring-heading" className="ds-sidebar-title">
        Your ring
      </h2>
      <div className="tryon-ring-card-image-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ring.ringImageUrl}
          alt="Hero render from your design pack"
          className="tryon-ring-card-image"
        />
      </div>
      <p className="tryon-ring-card-meta">Design {ring.designId}</p>
      <p className="ds-sidebar-body">
        This is the render we place on your hand. Use <strong>Adjust</strong> in the main panel if
        auto placement needs a small nudge.
      </p>
      <a href="/design" className="btn-ghost tryon-ring-card-cta">
        Back to design pack
      </a>
    </aside>
  );
}
