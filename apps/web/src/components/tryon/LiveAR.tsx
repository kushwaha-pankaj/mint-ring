"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadHandLandmarker, setVideoMode } from "@/lib/mediapipe-hand";
import { LM } from "@/lib/tryon-placement";
import { LiveARScene, type ARPlacement } from "@/lib/tryon-three-ring";

/**
 * Live AR ring try-on.
 *
 * Webcam stream + MediaPipe HandLandmarker (VIDEO mode, ~30 fps) drives
 * a Three.js scene that renders the textured GLB ring from the user's
 * design pack at the detected ring-finger position.
 *
 * Fully local: no per-frame API calls, no cost, no server in the loop.
 * Works after the GLB is downloaded once (~5-15 MB).
 */

export type LiveARStatus =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "ready" }
  | { kind: "running"; fps: number }
  | { kind: "no-hand" }
  | { kind: "error"; message: string };

type Props = {
  meshUrl: string;
  /** Notify parent of status changes so it can render a badge. */
  onStatus?: (s: LiveARStatus) => void;
  /** Notify parent when the user takes a snapshot. */
  onSnapshot?: (blob: Blob) => void;
};

type LiveFitAdjust = {
  anchorOffset: number;
  scale: number;
};

const LIVE_RING_ANCHOR_T = 0.58;
const LIVE_INNER_FIT_SCALE = 0.9;
const LIVE_POSITION_ALPHA = 0.18;
const LIVE_AXIS_ALPHA = 0.16;
const LIVE_DEPTH_ALPHA = 0.08;
const LIVE_SCALE_ALPHA = 0.12;
const LIVE_POSITION_DEADBAND_PX = 2.5;
const LIVE_AXIS_DEADBAND_RAD = 0.03;
const LIVE_DEPTH_DEADBAND = 0.008;
const LIVE_SCALE_DEADBAND = 0.012;
const DEFAULT_FIT_ADJUST: LiveFitAdjust = { anchorOffset: 0, scale: 1 };
const FIT_STORE_KEY = "hm.tryon.live-fit.v1";

export function LiveAR({ meshUrl, onStatus, onSnapshot }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sceneRef = useRef<LiveARScene | null>(null);
  const rafRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const landmarkerRef = useRef<Awaited<ReturnType<typeof loadHandLandmarker>> | null>(null);
  const fitAdjustRef = useRef<LiveFitAdjust>(DEFAULT_FIT_ADJUST);
  const fpsRef = useRef<{ frames: number; lastTick: number; lastReported: number }>({
    frames: 0,
    lastTick: 0,
    lastReported: 0,
  });

  // Stabilized placement state. MediaPipe landmarks jitter by a few pixels
  // even when the hand is stationary, so live AR needs deadbands plus
  // per-channel damping instead of one generic EMA.
  const smoothRef = useRef<ARPlacement | null>(null);

  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<LiveARStatus>({ kind: "idle" });
  const [fitAdjust, setFitAdjust] = useState<LiveFitAdjust>(() => readFitAdjust(meshUrl));

  // Push status changes up.
  useEffect(() => {
    onStatus?.(status);
  }, [status, onStatus]);

  useEffect(() => {
    const next = readFitAdjust(meshUrl);
    fitAdjustRef.current = next;
    setFitAdjust(next);
  }, [meshUrl]);

  useEffect(() => {
    fitAdjustRef.current = fitAdjust;
    writeFitAdjust(meshUrl, fitAdjust);
  }, [fitAdjust, meshUrl]);

  const stop = useCallback(() => {
    startingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    sceneRef.current?.dispose();
    sceneRef.current = null;
    landmarkerRef.current = null;
    smoothRef.current = null;
    setActive(false);
    setStatus({ kind: "idle" });
  }, []);

  // Stop on unmount / hidden-tab.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [stop]);

  const start = useCallback(async () => {
    if (startingRef.current || active) return;
    startingRef.current = true;
    setStatus({ kind: "loading", label: "Loading hand detector..." });
    try {
      // 1. MediaPipe HandLandmarker, VIDEO mode.
      const lm = await loadHandLandmarker();
      landmarkerRef.current = lm;
      await setVideoMode(lm);

      // 2. Webcam stream — selfie camera so the user can hold their hand up.
      setStatus({ kind: "loading", label: "Starting camera..." });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();

      // 3. Three.js scene + load the ring GLB.
      setStatus({ kind: "loading", label: "Loading 3D ring..." });
      const canvas = canvasRef.current;
      if (!canvas) {
        stop();
        return;
      }
      const scene = LiveARScene.create(canvas);
      sceneRef.current = scene;
      scene.resize(video.videoWidth, video.videoHeight);
      await scene.loadRing(meshUrl);
      scene.setVisible(false); // hidden until we have a hand

      setActive(true);
      setStatus({ kind: "ready" });
      startingRef.current = false;

      // 4. Render loop.
      fpsRef.current = { frames: 0, lastTick: performance.now(), lastReported: 0 };
      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        const v = videoRef.current;
        const s = sceneRef.current;
        const detector = landmarkerRef.current;
        if (!v || !s || !detector) return;

        // If the user resized the window, reflow the renderer.
        if (v.videoWidth > 0 && !s.matchesVideoSize(v.videoWidth, v.videoHeight)) {
          s.resize(v.videoWidth, v.videoHeight);
        }

        // Detect at video timestamp. MediaPipe needs strictly increasing
        // ts values; use performance.now() in ms.
        const ts = performance.now();
        const result = detector.detectForVideo(v, ts);
        const hands = result.landmarks ?? [];
        if (hands.length === 0) {
          // Don't toggle visibility every frame — only on actual change,
          // otherwise React paint pressure on the badge increases. Status
          // change is gated by a small dwell so it doesn't flicker if
          // the user briefly drops out of frame.
          if (s.ringGroup.visible) {
            s.setVisible(false);
            setStatus({ kind: "no-hand" });
          }
          s.render();
          return;
        }

        const raw = computeLiveARPlacement(
          hands[0],
          result.worldLandmarks?.[0],
          v.videoWidth,
          v.videoHeight,
          fitAdjustRef.current,
        );
        if (!raw) {
          s.render();
          return;
        }
        const next = stabilizePlacement(smoothRef.current, raw, v.videoWidth, v.videoHeight);
        smoothRef.current = next;

        s.updatePlacement(next, v.videoWidth, v.videoHeight);
        s.setVisible(true);
        s.render();

        // 1 Hz FPS sampling — only re-render when the rounded value changes.
        const f = fpsRef.current;
        f.frames += 1;
        if (ts - f.lastTick >= 1000) {
          const fps = Math.round((f.frames * 1000) / (ts - f.lastTick));
          f.frames = 0;
          f.lastTick = ts;
          if (fps !== f.lastReported) {
            f.lastReported = fps;
            setStatus({ kind: "running", fps });
          }
        }
      };
      loop();
    } catch (e) {
      startingRef.current = false;
      stop();
      setStatus({
        kind: "error",
        message:
          e instanceof Error
            ? e.message
            : "Could not start the live preview. Check camera permissions and try again.",
      });
    }
  }, [meshUrl, stop, active]);

  const nudgeFit = useCallback((patch: Partial<LiveFitAdjust>) => {
    setFitAdjust((current) => ({
      anchorOffset: clamp(
        patch.anchorOffset ?? current.anchorOffset,
        -0.18,
        0.18,
      ),
      scale: clamp(patch.scale ?? current.scale, 0.76, 1.18),
    }));
  }, []);

  const resetFit = useCallback(() => {
    setFitAdjust(DEFAULT_FIT_ADJUST);
  }, []);

  // Snapshot: composite the current video frame with the rendered scene
  // into a single JPEG for a full-size preview (parent shows a lightbox).
  const snapshot = useCallback(async () => {
    const v = videoRef.current;
    const s = sceneRef.current;
    if (!v || !s) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    // Mirror to match the preview (we render the video mirrored in CSS).
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, w, h);
    ctx.restore();
    // Three's canvas is already in the same coord space — mirror it too
    // so both layers stay aligned. Render once more first to be sure.
    s.render();
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(s.canvas, 0, 0, w, h);
    ctx.restore();

    const blob: Blob | null = await new Promise((res) =>
      off.toBlob((b) => res(b), "image/jpeg", 0.92),
    );
    if (blob) onSnapshot?.(blob);
  }, [onSnapshot]);

  return (
    <div className="ts-ar-wrap">
      <div className="ts-ar-frame">
        <video
          ref={videoRef}
          className="ts-ar-video"
          playsInline
          muted
          // Mirror the preview so it acts like a mirror — natural for
          // self-facing webcams. The Three.js canvas is mirrored via the
          // same CSS rule below so the two layers stay aligned.
        />
        <canvas ref={canvasRef} className="ts-ar-canvas" />
        {!active && (
          <div className="ts-ar-placeholder">
            {status.kind === "loading"
              ? status.label
              : status.kind === "error"
                ? status.message
                : "Hold your hand up to the camera, ring finger visible."}
          </div>
        )}
      </div>

      <div className="ts-ar-toolbar" role="toolbar" aria-label="Live AR controls">
        {active ? (
          <>
            <div className="ts-ar-toolbar-block ts-ar-toolbar-block--fit">
              <span className="ts-ar-toolbar-label">Ring fit</span>
              <div className="ts-ar-segment" aria-label="Adjust ring position and size">
                <button
                  type="button"
                  className="ts-ar-icon-btn"
                  onClick={() => nudgeFit({ anchorOffset: fitAdjust.anchorOffset - 0.03 })}
                  aria-label="Move ring down on finger"
                  title="Move down"
                >
                  <IconChevronDown />
                </button>
                <button
                  type="button"
                  className="ts-ar-icon-btn"
                  onClick={() => nudgeFit({ anchorOffset: fitAdjust.anchorOffset + 0.03 })}
                  aria-label="Move ring up on finger"
                  title="Move up"
                >
                  <IconChevronUp />
                </button>
                <span className="ts-ar-segment-divider" aria-hidden />
                <button
                  type="button"
                  className="ts-ar-icon-btn"
                  onClick={() => nudgeFit({ scale: fitAdjust.scale * 0.96 })}
                  aria-label="Make ring smaller"
                  title="Smaller"
                >
                  <IconMinus />
                </button>
                <button
                  type="button"
                  className="ts-ar-icon-btn"
                  onClick={() => nudgeFit({ scale: fitAdjust.scale * 1.04 })}
                  aria-label="Make ring larger"
                  title="Larger"
                >
                  <IconPlus />
                </button>
              </div>
              <button
                type="button"
                className="ts-ar-link-btn"
                onClick={resetFit}
                title="Restore default ring fit"
              >
                Reset
              </button>
            </div>

            <div className="ts-ar-toolbar-block ts-ar-toolbar-block--actions">
              <button type="button" className="ts-ar-pill-btn" onClick={stop}>
                <IconStop />
                Stop
              </button>
              <button
                type="button"
                className="ts-ar-pill-btn"
                onClick={() => {
                  const s = sceneRef.current;
                  if (!s) return;
                  s.cycleOrientation();
                  s.render();
                }}
                disabled={status.kind !== "running"}
                title="Cycle ring orientation (saved for this design)"
              >
                <IconRotate />
                Rotate
              </button>
              <button
                type="button"
                className="ts-ar-pill-btn ts-ar-pill-btn--primary"
                onClick={() => void snapshot()}
                disabled={status.kind !== "running"}
              >
                <IconCamera />
                Snapshot
              </button>
            </div>
          </>
        ) : (
          <div className="ts-ar-toolbar-block ts-ar-toolbar-block--start">
            <button
              type="button"
              className="ts-ar-pill-btn ts-ar-pill-btn--primary ts-ar-pill-btn--wide"
              onClick={() => void start()}
              disabled={status.kind === "loading"}
            >
              {status.kind === "loading" ? "Loading…" : "Start live AR"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function stabilizePlacement(
  prev: ARPlacement | null,
  raw: ARPlacement,
  videoWidth: number,
  videoHeight: number,
): ARPlacement {
  if (!prev) return raw;

  const dxPx = (raw.cx - prev.cx) * videoWidth;
  const dyPx = (raw.cy - prev.cy) * videoHeight;
  const centerStable = Math.hypot(dxPx, dyPx) <= LIVE_POSITION_DEADBAND_PX;

  const axisStable =
    angleBetweenPlacements(prev, raw, videoWidth, videoHeight) <= LIVE_AXIS_DEADBAND_RAD;
  const prevAxisZ = prev.axisZ ?? 0;
  const rawAxisZ = raw.axisZ ?? 0;
  const depthStable = Math.abs(rawAxisZ - prevAxisZ) <= LIVE_DEPTH_DEADBAND;

  const widthBase = Math.max(prev.widthHint, 0.0001);
  const scaleStable = Math.abs(raw.widthHint - prev.widthHint) / widthBase <= LIVE_SCALE_DEADBAND;

  return {
    cx: centerStable ? prev.cx : lerp(prev.cx, raw.cx, LIVE_POSITION_ALPHA),
    cy: centerStable ? prev.cy : lerp(prev.cy, raw.cy, LIVE_POSITION_ALPHA),
    axisX: axisStable ? prev.axisX : lerp(prev.axisX, raw.axisX, LIVE_AXIS_ALPHA),
    axisY: axisStable ? prev.axisY : lerp(prev.axisY, raw.axisY, LIVE_AXIS_ALPHA),
    axisZ: depthStable ? prevAxisZ : lerp(prevAxisZ, rawAxisZ, LIVE_DEPTH_ALPHA),
    widthHint: scaleStable ? prev.widthHint : lerp(prev.widthHint, raw.widthHint, LIVE_SCALE_ALPHA),
    depthZ: lerp(prev.depthZ ?? 0, raw.depthZ ?? 0, LIVE_DEPTH_ALPHA),
  };
}

function angleBetweenPlacements(
  a: ARPlacement,
  b: ARPlacement,
  videoWidth: number,
  videoHeight: number,
): number {
  const ax = a.axisX * videoWidth;
  const ay = a.axisY * videoHeight;
  const az = (a.axisZ ?? 0) * videoWidth;
  const bx = b.axisX * videoWidth;
  const by = b.axisY * videoHeight;
  const bz = (b.axisZ ?? 0) * videoWidth;
  const al = Math.hypot(ax, ay, az);
  const bl = Math.hypot(bx, by, bz);
  if (al < 0.0001 || bl < 0.0001) return 0;
  const dot = clamp((ax * bx + ay * by + az * bz) / (al * bl), -1, 1);
  return Math.acos(dot);
}

type HandLandmark = {
  x: number;
  y: number;
  z?: number;
};

/**
 * Convert MediaPipe hand landmarks into a stable ring placement.
 *
 * The renderer needs the ring's target inner diameter, not the raw
 * MCP-to-MCP distance. We estimate the soft-tissue finger width in pixel
 * space, add a small fit allowance, then normalise by video width.
 */
function computeLiveARPlacement(
  landmarks: HandLandmark[] | undefined,
  worldLandmarks: HandLandmark[] | undefined,
  videoWidth: number,
  videoHeight: number,
  fitAdjust: LiveFitAdjust,
): ARPlacement | null {
  if (!landmarks || landmarks.length < 21 || videoWidth < 1 || videoHeight < 1) return null;

  const mcp = landmarks[LM.RING_MCP];
  const pip = landmarks[LM.RING_PIP];
  const middleMcp = landmarks[LM.MIDDLE_MCP];
  const pinkyMcp = landmarks[LM.PINKY_MCP];
  if (!validLandmark(mcp) || !validLandmark(pip) || !validLandmark(pinkyMcp)) {
    return null;
  }

  const axisXPx = (pip.x - mcp.x) * videoWidth;
  const axisYPx = (pip.y - mcp.y) * videoHeight;
  const phalanxPx = Math.hypot(axisXPx, axisYPx);
  if (!Number.isFinite(phalanxPx) || phalanxPx < 18) return null;

  const gapSamples = [distPx(mcp, pinkyMcp, videoWidth, videoHeight)];
  if (validLandmark(middleMcp)) {
    gapSamples.push(distPx(middleMcp, mcp, videoWidth, videoHeight));
  }
  const centerGapPx = median(gapSamples.filter((v) => Number.isFinite(v) && v > 4));
  if (!Number.isFinite(centerGapPx)) return null;

  const fingerDiameterPx = clamp(centerGapPx * 0.92, phalanxPx * 0.35, phalanxPx * 0.74);
  const targetInnerDiameterPx = Math.max(
    14,
    fingerDiameterPx * LIVE_INNER_FIT_SCALE * fitAdjust.scale,
  );
  const axisZ = estimateSegmentDepth(
    landmarks,
    worldLandmarks,
    LM.RING_MCP,
    LM.RING_PIP,
    phalanxPx,
    videoWidth,
  );

  return {
    cx: mcp.x + (pip.x - mcp.x) * clamp(LIVE_RING_ANCHOR_T + fitAdjust.anchorOffset, 0.32, 0.82),
    cy: mcp.y + (pip.y - mcp.y) * clamp(LIVE_RING_ANCHOR_T + fitAdjust.anchorOffset, 0.32, 0.82),
    axisX: pip.x - mcp.x,
    axisY: pip.y - mcp.y,
    axisZ,
    widthHint: targetInnerDiameterPx / videoWidth,
    depthZ: typeof mcp.z === "number" ? mcp.z : 0,
  };
}

function validLandmark(lm: HandLandmark | undefined): lm is HandLandmark {
  return !!lm && Number.isFinite(lm.x) && Number.isFinite(lm.y);
}

function distPx(a: HandLandmark, b: HandLandmark, width: number, height: number): number {
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
}

function median(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function readFitAdjust(meshUrl: string): LiveFitAdjust {
  if (typeof window === "undefined") return DEFAULT_FIT_ADJUST;
  try {
    const raw = window.localStorage.getItem(FIT_STORE_KEY);
    if (!raw) return DEFAULT_FIT_ADJUST;
    const map = JSON.parse(raw) as Record<string, LiveFitAdjust>;
    const value = map[meshUrl];
    if (!value) return DEFAULT_FIT_ADJUST;
    return {
      anchorOffset: clamp(Number(value.anchorOffset) || 0, -0.18, 0.18),
      scale: clamp(Number(value.scale) || 1, 0.76, 1.18),
    };
  } catch {
    return DEFAULT_FIT_ADJUST;
  }
}

function writeFitAdjust(meshUrl: string, fit: LiveFitAdjust): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(FIT_STORE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, LiveFitAdjust>) : {};
    map[meshUrl] = fit;
    window.localStorage.setItem(FIT_STORE_KEY, JSON.stringify(map));
  } catch {
    /* localStorage can be blocked in private contexts */
  }
}

function IconChevronDown() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronUp() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

function IconRotate() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" strokeLinecap="round" />
      <path d="M18 4v4h-4M6 20v-4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 8h3l2-2h6l2 2h3v10H4V8z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function estimateSegmentDepth(
  landmarks: HandLandmark[],
  worldLandmarks: HandLandmark[] | undefined,
  startIdx: number,
  endIdx: number,
  segmentPx: number,
  videoWidth: number,
): number {
  const wa = worldLandmarks?.[startIdx];
  const wb = worldLandmarks?.[endIdx];
  if (validLandmark(wa) && validLandmark(wb)) {
    const xy = Math.hypot(wb.x - wa.x, wb.y - wa.y);
    const z = (wb.z ?? 0) - (wa.z ?? 0);
    if (xy > 0.0001 && Number.isFinite(z)) {
      const depthPx = clamp((z / xy) * segmentPx, -videoWidth * 0.18, videoWidth * 0.18);
      return depthPx / videoWidth;
    }
  }

  const a = landmarks[startIdx];
  const b = landmarks[endIdx];
  const z = (b?.z ?? 0) - (a?.z ?? 0);
  return Number.isFinite(z) ? clamp(z, -0.12, 0.12) : 0;
}
