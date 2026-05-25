"use client";

import { whenModelViewerReady } from "@/lib/model-viewer-ready";
import { createElement, useEffect, useRef, useState } from "react";

const MODEL_VIEWER_ENV =
  "https://modelviewer.dev/shared-assets/environments/lebombo_1k.hdr";

type Props = {
  glbUrl: string;
  posterUrl?: string;
  title: string;
  className?: string;
};

/** Inline research mesh viewer for the Try-on ring panel. */
export function TryOnMeshViewer({ glbUrl, posterUrl, title, className }: Props) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    whenModelViewerReady()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load the 3D viewer. Check your connection and try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = viewerRef.current;
    if (!ready || !el) return;
    const onErr = () =>
      setError("Could not load the mesh file. Regenerate the design pack with 3D mesh enabled.");
    el.addEventListener("error", onErr);
    return () => el.removeEventListener("error", onErr);
  }, [ready, glbUrl]);

  if (error) {
    return (
      <div className={`ts-mesh-viewer ts-mesh-viewer--error ${className ?? ""}`} role="alert">
        <p>{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={`ts-mesh-viewer ts-mesh-viewer--loading ${className ?? ""}`} role="status">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt="" className="ts-mesh-viewer-poster" />
        ) : null}
        <p>Loading 3D mesh…</p>
      </div>
    );
  }

  return createElement("model-viewer", {
    ref: viewerRef,
    className: `ts-mesh-viewer-el ${className ?? ""}`,
    src: glbUrl,
    alt: title,
    poster: posterUrl,
    "environment-image": MODEL_VIEWER_ENV,
    exposure: "1",
    "shadow-intensity": "0.85",
    "camera-controls": true,
    "auto-rotate": true,
    "rotation-per-second": "18deg",
    "interaction-prompt": "none",
    loading: "eager",
    reveal: "auto",
    ar: false,
  });
}
