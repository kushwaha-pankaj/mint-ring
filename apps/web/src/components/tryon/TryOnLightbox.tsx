"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function TryOnLightbox({
  url,
  label,
  onClose,
}: {
  url: string;
  label: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [handleClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="ts-lightbox"
      role="dialog"
      aria-modal
      aria-label={`Full size: ${label}`}
      onClick={handleClose}
    >
      <button
        type="button"
        className="ts-lightbox-close"
        onClick={handleClose}
        aria-label="Close full size preview"
      >
        Close
      </button>

      <figure className="ts-lightbox-figure" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} />
        <figcaption>{label}</figcaption>
      </figure>
    </div>,
    document.body,
  );
}
