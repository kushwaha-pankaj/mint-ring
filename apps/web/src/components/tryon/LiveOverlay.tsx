"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  applyAdjust,
  computeRingPlacement,
  NO_ADJUST,
  type ManualAdjust,
  type RingPlacement,
} from "@/lib/tryon-placement";
import { loadHandLandmarker, setImageMode } from "@/lib/mediapipe-hand";

/**
 * Placement preview canvas.
 *
 * We no longer composite the ring asset onto the hand. FLUX Kontext Multi
 * does the actual photoreal compositing server-side (it knows how to
 * render a band wrapping a finger; a 2D paste of a top-down product shot
 * does not). This canvas now exists to:
 *
 *   1. Show the hand photo at full resolution.
 *   2. Run MediaPipe and indicate which finger the ring will go on with
 *      a soft target marker — "ring goes here".
 *   3. In Adjust mode, let the user drag that marker to a different
 *      spot if the auto-detected location is wrong. The marker position
 *      is exposed to the page as a placement hint (normalised 0-1
 *      coords) that the page can ship to the backend if we want to feed
 *      it into the prompt later.
 *
 * It exposes `toHandImageBlob()` (a clean JPEG of the hand photo, no
 * marker drawn) — that's what gets uploaded to /api/tryon/generate.
 */

export type DetectionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; confidence: number; palmFacing: boolean }
  | { status: "no-hand" }
  | { status: "low-confidence"; confidence: number }
  | { status: "error"; message: string };

export type LiveOverlayHandle = {
  /** Encode the hand photo (no marker) as a JPEG for upload. */
  toHandImageBlob: (opts?: { quality?: number }) => Promise<Blob | null>;
  /** Re-run MediaPipe detection on the current image. */
  redetect: () => Promise<void>;
  /** Reset manual nudge back to identity. */
  resetAdjust: () => void;
  /** Current marker position in source-image pixels (auto + adjust). */
  getPlacement: () => RingPlacement | null;
  /** Same position but in normalised image coords [0..1]. */
  getPlacementHint: () => { x: number; y: number } | null;
};

type Props = {
  handImage: HTMLImageElement | null;
  mode: "auto" | "manual";
  /** Hide handles even in manual mode (e.g. while generating). */
  uiFrozen?: boolean;
  onDetectionChange?: (state: DetectionState) => void;
};

const MARKER_HANDLE_SIZE = 14;

export const LiveOverlay = forwardRef<LiveOverlayHandle, Props>(function LiveOverlay(
  { handImage, mode, uiFrozen, onDetectionChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [autoPlacement, setAutoPlacement] = useState<RingPlacement | null>(null);
  const [adjust, setAdjust] = useState<ManualAdjust>(NO_ADJUST);
  const [detection, setDetection] = useState<DetectionState>({ status: "idle" });

  const placement = autoPlacement ? applyAdjust(autoPlacement, adjust) : null;

  useEffect(() => {
    onDetectionChange?.(detection);
  }, [detection, onDetectionChange]);

  const runDetection = useCallback(async () => {
    if (!handImage || !handImage.complete) {
      setDetection({ status: "idle" });
      setAutoPlacement(null);
      return;
    }
    setDetection({ status: "loading" });
    try {
      const lm = await loadHandLandmarker();
      // The HandLandmarker singleton may have been switched to VIDEO mode
      // by Live AR. Switch back to IMAGE before a still-frame detect, or
      // it throws "Task is not initialized with image mode".
      await setImageMode(lm);
      const result = lm.detect(handImage);
      const hands = result.landmarks ?? [];
      if (hands.length === 0) {
        setAutoPlacement(null);
        setDetection({ status: "no-hand" });
        return;
      }
      const p = computeRingPlacement(
        hands[0],
        handImage.naturalWidth,
        handImage.naturalHeight,
      );
      if (!p) {
        setAutoPlacement(null);
        setDetection({ status: "no-hand" });
        return;
      }
      setAutoPlacement(p);
      if (p.confidence < 0.35) {
        setDetection({ status: "low-confidence", confidence: p.confidence });
      } else {
        setDetection({
          status: "ok",
          confidence: p.confidence,
          palmFacing: p.palmFacing,
        });
      }
    } catch (e) {
      setAutoPlacement(null);
      setDetection({
        status: "error",
        message:
          e instanceof Error
            ? e.message
            : "Hand detection failed. You can still drag the marker in Adjust.",
      });
    }
  }, [handImage]);

  useEffect(() => {
    void runDetection();
    setAdjust(NO_ADJUST);
  }, [handImage, runDetection]);

  const layoutCanvasDisplay = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = canvas?.parentElement;
    if (!canvas || !wrap) return;
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) {
      canvas.style.width = "";
      canvas.style.height = "";
      return;
    }
    const maxW = wrap.clientWidth;
    const maxH = wrap.clientHeight;
    if (!maxW || !maxH) return;
    const scale = Math.min(maxW / w, maxH / h);
    canvas.style.width = `${Math.round(w * scale)}px`;
    canvas.style.height = `${Math.round(h * scale)}px`;
  }, []);

  // Paint: hand photo + (optional) marker. NEVER composite the ring here.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !handImage || !handImage.complete) return;
    canvas.width = handImage.naturalWidth;
    canvas.height = handImage.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(handImage, 0, 0);
    if (placement) {
      drawTargetMarker(ctx, placement);
      if (mode === "manual" && !uiFrozen) {
        drawDragHandles(ctx, placement);
      }
    }
    layoutCanvasDisplay();
  }, [handImage, placement, mode, uiFrozen, layoutCanvasDisplay]);

  useEffect(() => {
    const wrap = canvasRef.current?.parentElement;
    if (!wrap || !handImage) return;
    const ro = new ResizeObserver(() => layoutCanvasDisplay());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [handImage, layoutCanvasDisplay]);

  // ---- manual drag interaction ----
  const dragState = useRef<{
    startX: number;
    startY: number;
    startAdjust: ManualAdjust;
  } | null>(null);

  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * sx,
      y: (clientY - rect.top) * sy,
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (mode !== "manual" || uiFrozen) return;
      if (!placement) return;
      const pt = clientToCanvas(e.clientX, e.clientY);
      if (!pt) return;
      dragState.current = {
        startX: pt.x,
        startY: pt.y,
        startAdjust: { ...adjust },
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [adjust, clientToCanvas, mode, placement, uiFrozen],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const s = dragState.current;
      if (!s) return;
      const pt = clientToCanvas(e.clientX, e.clientY);
      if (!pt) return;
      setAdjust({
        ...s.startAdjust,
        dx: s.startAdjust.dx + (pt.x - s.startX),
        dy: s.startAdjust.dy + (pt.y - s.startY),
      });
    },
    [clientToCanvas],
  );

  const endDrag = useCallback(() => {
    dragState.current = null;
  }, []);

  useImperativeHandle(ref, () => ({
    async toHandImageBlob(opts) {
      if (!handImage) return null;
      // Re-encode the original hand photo at full resolution. The
      // *displayed* canvas has the marker drawn on it — never send that
      // to FLUX, because the green dot would become part of the input.
      const off = document.createElement("canvas");
      off.width = handImage.naturalWidth;
      off.height = handImage.naturalHeight;
      const cx = off.getContext("2d");
      if (!cx) return null;
      cx.drawImage(handImage, 0, 0);
      return new Promise<Blob | null>((resolve) =>
        off.toBlob((b) => resolve(b), "image/jpeg", opts?.quality ?? 0.92),
      );
    },
    redetect: runDetection,
    resetAdjust: () => setAdjust(NO_ADJUST),
    getPlacement: () => placement,
    getPlacementHint: () => {
      if (!placement || !handImage) return null;
      return {
        x: placement.centerX / handImage.naturalWidth,
        y: placement.centerY / handImage.naturalHeight,
      };
    },
  }));

  return (
    <div className="tryon-canvas-wrap">
      <canvas
        ref={canvasRef}
        className={`tryon-canvas ${mode === "manual" && !uiFrozen ? "tryon-canvas--editable" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      {!handImage && (
        <div className="tryon-canvas-empty">
          Upload or capture a hand photo to begin.
        </div>
      )}
    </div>
  );
});

// --- canvas helpers ----------------------------------------------------

/**
 * Soft target marker showing "ring goes approximately here". Drawn as a
 * dashed circle scaled to the finger width, plus a centre dot and a
 * short cross-hair. The radius is *symbolic* — FLUX picks the final
 * size; this is just user feedback.
 */
function drawTargetMarker(ctx: CanvasRenderingContext2D, p: RingPlacement) {
  const radius = Math.max(18, p.width * 0.45);
  ctx.save();
  ctx.translate(p.centerX, p.centerY);

  // Soft glow halo so the marker stays visible on busy backgrounds.
  ctx.save();
  ctx.fillStyle = "rgba(0, 164, 120, 0.18)";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Dashed ring (the actual target).
  ctx.strokeStyle = "rgba(0, 164, 120, 0.95)";
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.setLineDash([radius * 0.4, radius * 0.25]);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crosshair.
  const crossLen = radius * 0.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-crossLen, 0);
  ctx.lineTo(crossLen, 0);
  ctx.moveTo(0, -crossLen);
  ctx.lineTo(0, crossLen);
  ctx.stroke();

  // Centre dot.
  ctx.fillStyle = "#00a478";
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(3, radius * 0.1), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * In Adjust mode, draw a single grab handle ring around the marker so
 * the affordance is unmistakable. Scale/rotate handles aren't shown
 * because FLUX picks size and angle — only position matters for the hint.
 */
function drawDragHandles(ctx: CanvasRenderingContext2D, p: RingPlacement) {
  const radius = Math.max(22, p.width * 0.55);
  ctx.save();
  ctx.strokeStyle = "#00a478";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(p.centerX, p.centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Small white pip on each of the 4 cardinals as a "drag me" hint.
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#00a478";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      p.centerX + dx * radius,
      p.centerY + dy * radius,
      MARKER_HANDLE_SIZE * 0.45,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
