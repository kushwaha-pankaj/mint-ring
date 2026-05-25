"use client";

import { whenModelViewerReady } from "@/lib/model-viewer-ready";
import { createElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Soft studio HDRI — closer to the pack hero lighting than neutral grey. */
const MODEL_VIEWER_ENV =
  "https://modelviewer.dev/shared-assets/environments/lebombo_1k.hdr";

export function MeshViewModal({
  open,
  onClose,
  glbUrl,
  posterUrl,
  title = "Research 3D preview",
}: {
  open: boolean;
  onClose: () => void;
  glbUrl: string;
  /** Hero render shown while the GLB loads — keeps parity with the 2D product shot. */
  posterUrl?: string;
  title?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setViewerReady(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    whenModelViewerReady()
      .then(() => {
        if (!cancelled) setViewerReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Could not load the 3D viewer. Check your connection and try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    const el = viewerRef.current;
    if (!open || !viewerReady || !el) return;
    const onErr = () =>
      setLoadError("Could not load the mesh file. Try generating the pack again.");
    el.addEventListener("error", onErr);
    return () => el.removeEventListener("error", onErr);
  }, [open, viewerReady, glbUrl]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="ds-mesh-modal"
      role="dialog"
      aria-modal
      aria-labelledby="ds-mesh-modal-title"
      onClick={onClose}
    >
      <div className="ds-mesh-modal-panel" onClick={(e) => e.stopPropagation()}>
        <header className="ds-mesh-modal-head">
          <div>
            <p className="studio-label">Research mesh</p>
            <h2 id="ds-mesh-modal-title" className="ds-mesh-modal-title">
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="ds-mesh-modal-close"
            onClick={onClose}
            aria-label="Close 3D preview"
          >
            ×
          </button>
        </header>

        <div className="ds-mesh-modal-viewer-wrap">
          {!viewerReady && !loadError && (
            <p className="ds-mesh-modal-loading" role="status">
              Loading 3D viewer…
            </p>
          )}
          {loadError && (
            <p className="ds-mesh-modal-error" role="alert">
              {loadError}
            </p>
          )}
          {viewerReady &&
            !loadError &&
            createElement("model-viewer", {
              key: glbUrl,
              ref: (node: HTMLElement | null) => {
                viewerRef.current = node;
              },
              src: glbUrl,
              poster: posterUrl,
              alt: "AI-generated ring mesh",
              crossOrigin: "anonymous",
              "camera-controls": true,
              "touch-action": "pan-y",
              "camera-orbit": "0deg 82deg 110%",
              "min-camera-orbit": "auto auto 88%",
              "max-camera-orbit": "auto auto 135%",
              exposure: "1.12",
              "shadow-intensity": "0.42",
              "shadow-softness": "0.85",
              "environment-image": MODEL_VIEWER_ENV,
              "tone-mapping": "commerce",
              "auto-rotate": false,
              "interaction-prompt": "none",
            })}
        </div>

        <p className="ds-mesh-modal-note">
          Drag to orbit. Scroll to zoom. Built with fal Meshy v5 multi-image-to-3d
          when four turntable views are available. AI-estimated, not manufacturing CAD.
        </p>

        <div className="ds-mesh-modal-actions">
          <button type="button" className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
