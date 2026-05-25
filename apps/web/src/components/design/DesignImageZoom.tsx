"use client";

import ImageZoom from "js-image-zoom";
import { useEffect, useRef, useState } from "react";

const ZOOM_LENS_STYLE =
  "opacity: 0.38; background-color: rgba(0, 164, 120, 0.1); border: 1px solid rgba(0, 61, 34, 0.22);";
const ZOOM_PANEL_STYLE =
  "border-radius: 0; box-shadow: 0 24px 48px rgba(29, 24, 19, 0.16); border: 1px solid rgba(0, 0, 0, 0.08);";

/** Target lens width as a fraction of the displayed image (higher = less magnification). */
const LENS_FRACTION = 0.5;

function resolveZoomWidth(displayWidth: number, naturalWidth: number, magnify: number) {
  const natural = naturalWidth > 0 ? naturalWidth : displayWidth;
  const zoomWidth = natural * LENS_FRACTION * magnify;
  return Math.round(
    Math.min(Math.max(zoomWidth, displayWidth * 0.92), displayWidth * 1.65),
  );
}

export function DesignImageZoom({
  src,
  alt,
  fit = "cover",
  magnify = 1,
  zoomPosition = "original",
  enabled = true,
  className,
}: {
  src: string;
  alt: string;
  /** width = 100% of container, height from aspect ratio (no side letterboxing) */
  fit?: "cover" | "contain" | "width";
  /** 1 = gentle default; slightly above 1 widens the lens (less magnification). */
  magnify?: number;
  zoomPosition?: "top" | "left" | "bottom" | "right" | "original";
  /** Set false while dragging or when zoom would conflict with another interaction. */
  enabled?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomMountRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (width > 0 && height > 0) {
        setSize({ width, height });
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  useEffect(() => {
    if (!enabled || !canHover || !size) return;
    const mount = zoomMountRef.current;
    if (!mount) return;

    let cancelled = false;
    let instance: ReturnType<typeof ImageZoom> | null = null;

    const probe = new Image();
    probe.src = src;

    const mountZoom = () => {
      if (cancelled || !zoomMountRef.current) return;

      const zoomWidth = resolveZoomWidth(size.width, probe.naturalWidth, magnify);

      instance = ImageZoom(zoomMountRef.current, {
        img: src,
        width: size.width,
        height: size.height,
        zoomWidth,
        zoomPosition,
        zoomLensStyle: ZOOM_LENS_STYLE,
        zoomStyle: ZOOM_PANEL_STYLE,
      });
    };

    if (probe.complete) {
      mountZoom();
    } else {
      probe.onload = mountZoom;
      probe.onerror = mountZoom;
    }

    return () => {
      cancelled = true;
      instance?.kill();
    };
  }, [enabled, canHover, size, src, magnify, zoomPosition]);

  const zoomActive = enabled && canHover && size;

  const rootClass = [
    "ds-image-zoom",
    fit === "contain" ? "ds-image-zoom--contain" : "",
    fit === "width" ? "ds-image-zoom--width" : "",
    zoomActive ? "" : "ds-image-zoom--paused",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={containerRef} className={rootClass}>
      {zoomActive ? (
        <div ref={zoomMountRef} className="ds-image-zoom-mount" aria-label={alt} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className={fit === "width" ? "ds-image-zoom-img--width" : undefined}
        />
      )}
    </div>
  );
}
