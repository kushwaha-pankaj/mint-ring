"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DetectionMeta } from "@/lib/api";

function overlayFontFamily(): string {
  if (typeof document === "undefined") {
    return '"Inter Tight", "Korolev", system-ui, sans-serif';
  }
  return getComputedStyle(document.body).fontFamily;
}

/**
 * Canvas overlay that renders the user's photograph with the detector's
 * bounding box, hand landmarks, and finger highlight — the classic
 * object-detection visualisation, branded in mint green.
 *
 * Implementation note: we draw the photo + overlay into ONE canvas (single
 * source of truth for pixel coords). A ResizeObserver keeps the canvas
 * snapped to the container width so the overlay scales correctly when the
 * grid breakpoint shifts.
 */
export function DetectionOverlay({
  imageSrc,
  detection,
  className,
  onPickCandidate,
}: {
  imageSrc: string;
  detection: DetectionMeta;
  className?: string;
  onPickCandidate?: (idx: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);

  // Load the image once so we can repaint on every resize without re-decoding.
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setImgEl(img);
    };
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imgEl) return;

    const srcW = detection.imageWidth ?? imgEl.naturalWidth;
    const srcH = detection.imageHeight ?? imgEl.naturalHeight;
    if (!srcW || !srcH) return;

    // Fit the canvas inside the container while preserving aspect ratio.
    const containerW = container.clientWidth;
    const scale = containerW / srcW;
    const displayW = containerW;
    const displayH = srcH * scale;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayW * dpr);
    canvas.height = Math.round(displayH * dpr);
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, srcW, srcH);
    ctx.drawImage(imgEl, 0, 0, srcW, srcH);

    // ---- Hand skeleton (subtle white-ish lines) -----------------------------
    if (detection.landmarks && detection.landmarks.length === 21) {
      const lm = detection.landmarks;
      ctx.lineWidth = Math.max(1.2, srcW * 0.0025);
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
      ctx.shadowBlur = 6;
      drawConnections(ctx, lm, HAND_CONNECTIONS);
      ctx.shadowBlur = 0;

      // Landmark points
      const dotR = Math.max(2.5, srcW * 0.005);
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      for (const p of lm) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Highlight the chosen finger's MCP–PIP segment in brand green.
      if (typeof detection.fingerIndex === "number") {
        const segment = FINGER_INDEX_TO_MCP_PIP[detection.fingerIndex];
        if (segment) {
          const [mcp, pip] = segment;
          ctx.strokeStyle = "#00A478";
          ctx.lineWidth = Math.max(2.4, srcW * 0.005);
          ctx.beginPath();
          ctx.moveTo(lm[mcp].x, lm[mcp].y);
          ctx.lineTo(lm[pip].x, lm[pip].y);
          ctx.stroke();
          ctx.fillStyle = "#00A478";
          for (const idx of [mcp, pip]) {
            ctx.beginPath();
            ctx.arc(lm[idx].x, lm[idx].y, dotR * 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // ---- Bounding boxes for every candidate ---------------------------------
    // Chosen one is bold mint with corner brackets and a full label chip.
    // Runners-up are thin grey outlines with a compact confidence tag — the
    // panel can click them to promote.
    const candidates = detection.candidates ?? (detection.bbox
      ? [{
          bbox: detection.bbox,
          confidence: detection.detectionScore ?? 1,
          finger: detection.finger,
          fingerIndex: detection.fingerIndex,
          classLabel: "Ring",
        }]
      : []);
    const chosenIdx = detection.chosenIdx ?? 0;
    const strokeW = Math.max(2.2, srcW * 0.004);
    const fontSize = Math.max(11, srcW * 0.018);
    ctx.font = `500 ${fontSize}px ${overlayFontFamily()}`;

    candidates.forEach((cand, i) => {
      const [bx, by, bw, bh] = cand.bbox;
      const isChosen = i === chosenIdx;

      if (isChosen) {
        ctx.shadowColor = "rgba(0, 164, 120, 0.45)";
        ctx.shadowBlur = 12;
        ctx.strokeStyle = "#00A478";
        ctx.lineWidth = strokeW;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.shadowBlur = 0;
        drawCornerBrackets(ctx, bx, by, bw, bh, strokeW * 2);

        const labelParts: string[] = ["RING"];
        if (cand.finger) labelParts.push(`· ${cand.finger.toUpperCase()} FINGER`);
        const conf = Math.round(cand.confidence * 100);
        labelParts.push(`· ${conf}%`);
        const label = labelParts.join(" ");
        const padX = fontSize * 0.7;
        const padY = fontSize * 0.45;
        const textW = ctx.measureText(label).width;
        const chipW = textW + padX * 2;
        const chipH = fontSize + padY * 2;
        const cx0 = bx;
        const cy0 = Math.max(0, by - chipH - 4);
        ctx.fillStyle = "#00A478";
        ctx.fillRect(cx0, cy0, chipW, chipH);
        ctx.fillStyle = "#FFFFFF";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx0 + padX, cy0 + chipH / 2);
      } else {
        // Runner-up — faint grey outline + small confidence tag in corner.
        ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
        ctx.lineWidth = Math.max(1, strokeW * 0.5);
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        const conf = Math.round(cand.confidence * 100);
        const tag = `${conf}%`;
        const tagFont = Math.max(10, fontSize * 0.78);
        ctx.font = `400 ${tagFont}px ${overlayFontFamily()}`;
        const padX = tagFont * 0.55;
        const padY = tagFont * 0.35;
        const textW = ctx.measureText(tag).width;
        const chipW = textW + padX * 2;
        const chipH = tagFont + padY * 2;
        const cx0 = Math.min(bx + bw - chipW, srcW - chipW);
        const cy0 = by + 4;
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(cx0, cy0, chipW, chipH);
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.textBaseline = "middle";
        ctx.fillText(tag, cx0 + padX, cy0 + chipH / 2);
        ctx.font = `500 ${fontSize}px ${overlayFontFamily()}`; // restore
      }
    });
  }, [imgEl, detection]);

  // Initial draw + observe container resizes.
  useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  /**
   * Click handler: convert page coords to source-image coords, see which
   * candidate's bbox we're inside, fire the callback if it's a runner-up.
   */
  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!onPickCandidate || !detection.candidates || detection.candidates.length < 2) return;
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;
    const srcW = detection.imageWidth ?? imgEl.naturalWidth;
    const srcH = detection.imageHeight ?? imgEl.naturalHeight;
    const rect = canvas.getBoundingClientRect();
    const scale = srcW / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    if (x < 0 || y < 0 || x > srcW || y > srcH) return;

    const chosenIdx = detection.chosenIdx ?? 0;
    // Iterate runners-up first (they were painted underneath) — clicking
    // through to a chosen box should be a no-op.
    let bestIdx = -1;
    let bestArea = Infinity;
    detection.candidates.forEach((cand, i) => {
      if (i === chosenIdx) return;
      const [bx, by, bw, bh] = cand.bbox;
      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        const area = bw * bh;
        if (area < bestArea) {
          bestArea = area;
          bestIdx = i;
        }
      }
    });
    if (bestIdx !== -1) onPickCandidate(bestIdx);
  }

  const isClickable =
    !!onPickCandidate && (detection.candidates?.length ?? 0) > 1;

  return (
    <div ref={containerRef} className={className ?? "detection-overlay"}>
      <canvas
        ref={canvasRef}
        className="detection-overlay-canvas"
        onClick={isClickable ? onCanvasClick : undefined}
        style={isClickable ? { cursor: "pointer" } : undefined}
      />
    </div>
  );
}

/* ----------------------------- drawing helpers ---------------------------- */

function drawConnections(
  ctx: CanvasRenderingContext2D,
  lm: { x: number; y: number }[],
  pairs: readonly [number, number][],
) {
  ctx.beginPath();
  for (const [a, b] of pairs) {
    ctx.moveTo(lm[a].x, lm[a].y);
    ctx.lineTo(lm[b].x, lm[b].y);
  }
  ctx.stroke();
}

function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  thickness: number,
) {
  const armLen = Math.min(w, h) * 0.22;
  ctx.strokeStyle = "#00A478";
  ctx.lineWidth = thickness;
  ctx.lineCap = "square";

  const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * armLen);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * armLen, cy);
    ctx.stroke();
  };

  drawCorner(x, y, 1, 1);              // top-left
  drawCorner(x + w, y, -1, 1);         // top-right
  drawCorner(x, y + h, 1, -1);         // bottom-left
  drawCorner(x + w, y + h, -1, -1);    // bottom-right
}

// MediaPipe Hands canonical connection list — 21 keypoints.
const HAND_CONNECTIONS: readonly [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [5, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [9, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

// Maps fingerIndex (0=index,1=middle,2=ring,3=pinky) → [mcpIdx, pipIdx].
const FINGER_INDEX_TO_MCP_PIP: Record<number, [number, number]> = {
  0: [5, 6],
  1: [9, 10],
  2: [13, 14],
  3: [17, 18],
};
