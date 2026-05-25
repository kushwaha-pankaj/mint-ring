"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StageStatus } from "@/lib/design-api";
import { MeshViewModal } from "./MeshViewModal";

export type TurntableFrame = {
  label: string;
  degrees: number;
  url: string;
};

/**
 * Browse different angle views of the same ring from the multi-angle stage.
 */
export function TurntableViewer({
  frames,
  loading,
  expectedFrameCount = 4,
  meshGlbUrl,
  meshStatus,
  meshPosterUrl,
}: {
  frames: TurntableFrame[];
  loading?: boolean;
  expectedFrameCount?: number;
  /** When set, shows a 3D view button that opens a GLB modal. */
  meshGlbUrl?: string;
  meshStatus?: StageStatus;
  /** Hero render — used as the model-viewer poster for visual continuity. */
  meshPosterUrl?: string;
}) {
  const [index, setIndex] = useState(0);
  const [meshOpen, setMeshOpen] = useState(false);
  const showMesh = meshStatus !== undefined && meshStatus !== "skipped";
  const meshReady = meshStatus === "done" && Boolean(meshGlbUrl);
  const meshBusy =
    meshStatus === "pending" || meshStatus === "running";
  const dragStartRef = useRef<{ x: number; index: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (index >= frames.length && frames.length > 0) {
      setIndex(0);
    }
  }, [frames.length, index]);

  const updateFromDrag = useCallback(
    (clientX: number) => {
      if (!dragStartRef.current || frames.length === 0) return;
      const container = containerRef.current;
      if (!container) return;
      const width = Math.max(1, container.getBoundingClientRect().width);
      const deltaX = clientX - dragStartRef.current.x;
      const framesPerWidth = frames.length;
      const offset = Math.round((deltaX / width) * framesPerWidth);
      const next =
        ((dragStartRef.current.index + offset) % frames.length + frames.length) %
        frames.length;
      setIndex(next);
    },
    [frames.length],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (frames.length === 0) return;
      if ((e.target as HTMLElement).closest(".ds-turntable-3d-wrap")) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragStartRef.current = { x: e.clientX, index };
    },
    [frames.length, index],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      updateFromDrag(e.clientX);
    },
    [updateFromDrag],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (frames.length === 0) return;
      if (e.key === "ArrowRight") {
        setIndex((i) => (i + 1) % frames.length);
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => (i - 1 + frames.length) % frames.length);
        e.preventDefault();
      }
    },
    [frames.length],
  );

  const current = frames[index];
  const total = frames.length || expectedFrameCount;

  return (
    <div className="ds-turntable">
      <div
        ref={containerRef}
        className={`ds-turntable-stage ${loading ? "ds-turntable-stage--loading" : ""}`}
        role="img"
        aria-label={
          current
            ? `Ring view at ${current.degrees}°: ${current.label}`
            : "Different angle views loading"
        }
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKey}
      >
        {frames.map((frame, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={frame.url}
            src={frame.url}
            alt=""
            draggable={false}
            className={`ds-turntable-frame ${i === index ? "ds-turntable-frame--active" : ""}`}
          />
        ))}
        {frames.length === 0 && (
          <p className="ds-turntable-empty">Preparing angle views…</p>
        )}
        <div className="ds-turntable-hud" aria-hidden>
          <span className="ds-turntable-hud-degree">
            {current ? `${current.degrees}°` : "0°"}
          </span>
          <span className="ds-turntable-hud-name">{current?.label ?? "Front"}</span>
        </div>
        {showMesh && (
          <div
            className="ds-turntable-3d-wrap"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn-primary ds-turntable-3d"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (meshReady) setMeshOpen(true);
              }}
              disabled={!meshReady}
              title={
                meshReady
                  ? "Open rotatable 3D mesh"
                  : meshBusy
                    ? "Meshy v5 is building the 3D mesh (often 3–7 minutes)"
                    : meshStatus === "failed"
                      ? "3D mesh could not be generated for this pack"
                      : "3D mesh unavailable"
              }
            >
              <MeshIcon />
              {meshBusy ? "Research mesh…" : "3D view"}
            </button>
          </div>
        )}
      </div>

      <div className="ds-turntable-toolbar">
        <button
          type="button"
          className="btn-ghost ds-wizard-back ds-wizard-back--outline ds-turntable-nav"
          onClick={() =>
            setIndex((i) => (i - 1 + Math.max(1, frames.length)) % Math.max(1, frames.length))
          }
          disabled={frames.length < 2}
          aria-label="Previous view"
        >
          <ChevronIcon direction="left" />
          Previous view
        </button>

        <p className="ds-turntable-counter">
          View <strong>{frames.length === 0 ? 0 : index + 1}</strong> of {total}
        </p>

        <button
          type="button"
          className="btn-ghost ds-wizard-back ds-wizard-back--outline ds-turntable-nav"
          onClick={() => setIndex((i) => (i + 1) % Math.max(1, frames.length))}
          disabled={frames.length < 2}
          aria-label="Next view"
        >
          Next view
          <ChevronIcon direction="right" />
        </button>
      </div>

      {frames.length > 0 && (
        <div className="ds-turntable-strip" role="listbox" aria-label="Jump to angle">
          {frames.map((frame, i) => (
            <button
              key={`${frame.degrees}-${frame.url}`}
              type="button"
              className={`ds-turntable-chip ${i === index ? "ds-turntable-chip--active btn-primary" : "btn-ghost ds-turntable-chip--idle"}`}
              onClick={() => setIndex(i)}
              role="option"
              aria-selected={i === index}
            >
              <span className="ds-turntable-chip-value">{frame.degrees}</span>
              <span className="ds-turntable-chip-unit">deg</span>
            </button>
          ))}
        </div>
      )}

      <p className="ds-turntable-hint">
        Drag across the image to rotate viewpoints, or use the degree chips and arrow keys to
        jump between views.
        {showMesh && meshReady && " Use 3D view for a research mesh you can orbit freely."}
      </p>

      {showMesh && meshGlbUrl && (
        <MeshViewModal
          open={meshOpen}
          onClose={() => setMeshOpen(false)}
          glbUrl={meshGlbUrl}
          posterUrl={meshPosterUrl}
        />
      )}
    </div>
  );
}

function MeshIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="ds-turntable-3d-icon">
      <path
        d="M10 3l6.5 4v6L10 17l-6.5-4V7L10 3z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M10 3v14M3.5 7l6.5 4m6.5-4l-6.5 4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`ds-turntable-chevron ds-turntable-chevron--${direction}`}
      fill="none"
      aria-hidden
    >
      <path
        d={direction === "left" ? "M12 5l-5 5 5 5" : "M8 5l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
