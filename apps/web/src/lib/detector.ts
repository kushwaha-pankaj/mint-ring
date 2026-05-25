/**
 * Browser-side ring detector built on MediaPipe Hands.
 *
 * Pipeline: image File → decode → MediaPipe HandLandmarker → 21 landmarks
 *           → pick the most plausible finger that could be wearing a ring
 *           → crop a square region around the MCP-PIP midpoint of that finger
 *           → return the crop as a File the API can ingest unchanged.
 *
 * If no hand is detected (e.g. catalogue sample, ring on velvet) the call
 * resolves with applied=false and the caller falls back to the original
 * image — that's by design.
 */

import type { Landmark } from "@mediapipe/tasks-vision";
import { detectRing as detectRingApi } from "./api";
import { loadHandLandmarker, setImageMode } from "./mediapipe-hand";
import {
  bboxCentreInside,
  handBoundingBox,
  resolveFingerForBox,
  RING_FINGERS,
  type FingerName as ResolvedFingerName,
} from "./finger-resolve";

/** MediaPipe Hands landmark indices, restricted to the four ringable fingers. */
const FINGERS = [
  { name: "index", mcp: 5, pip: 6 },
  { name: "middle", mcp: 9, pip: 10 },
  { name: "ring", mcp: 13, pip: 14 },
  { name: "pinky", mcp: 17, pip: 18 },
] as const;

type FingerName = (typeof FINGERS)[number]["name"];

/** 21 MediaPipe Hands landmarks in source-pixel coords. */
export type LandmarkPoint = { x: number; y: number };

export type DetectionSource = "groundingdino";

export type DetectionCandidate = {
  bbox: [number, number, number, number];
  confidence: number;
  finger?: ResolvedFingerName;
  fingerIndex?: number;
  classLabel?: string;
};

export type DetectionResult = {
  /** True iff a hand was found and a ring region was extracted. */
  applied: boolean;
  /** Which backend produced the result we render. */
  detectionSource?: DetectionSource;
  /** Friendly label for the detector model. */
  detectorLabel?: string;
  /** True when the hosted detector could not run, so the UI can explain it. */
  detectionUnavailable?: boolean;
  /** Human-readable detector status for demo copy and diagnostics. */
  detectionReason?: string;
  /** All detections above threshold, sorted by confidence desc. */
  candidates?: DetectionCandidate[];
  /** Which candidate is currently the "chosen" one (index into candidates). */
  chosenIdx?: number;
  /** Cropped image as a File, ready to POST to /api/identify. */
  crop?: File;
  /** ObjectURL for the crop, for rendering in the UI. Caller revokes. */
  cropUrl?: string;
  /** Bounding box (of the chosen candidate) in source-pixel coords [x, y, w, h]. */
  bbox?: [number, number, number, number];
  /** Which finger was selected (e.g. "ring"). */
  finger?: ResolvedFingerName;
  /** Index of the chosen finger in the FINGERS list (0..3) — convenience. */
  fingerIndex?: number;
  /** All 21 hand landmarks, source-pixel coords, for overlay rendering. */
  landmarks?: LandmarkPoint[];
  /** Hand handedness ("Left" | "Right") from MediaPipe. */
  handedness?: string;
  /** MediaPipe handedness score (0..1). */
  handednessScore?: number;
  /** Detector's confidence (0..1) for the chosen candidate. */
  detectionScore?: number;
  /**
   * True when the detector found no ring-like evidence.
   */
  noRingFound?: boolean;
  /** Source image dimensions, so the UI can size the overlay canvas. */
  imageWidth?: number;
  imageHeight?: number;
  /** Detection latency in ms total (decode + detector + crop). */
  latencyMs: number;
  /** Detector method tag. */
  method: "MediaPipe Hands (browser)";
};

/* ------------------------------- main API -------------------------------- */

export async function detectRingRegion(file: File): Promise<DetectionResult> {
  const start = performance.now();
  const skipped = (
    latencyMs: number,
    detail: Partial<Omit<DetectionResult, "applied" | "latencyMs" | "method">> = {},
  ): DetectionResult => ({
    applied: false,
    ...detail,
    latencyMs,
    method: "MediaPipe Hands (browser)",
  });

  // 1. Decode the source image once. ImageBitmap is cheap to draw repeatedly,
  //    so we share it across MediaPipe inference + canvas crops.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return skipped(performance.now() - start);
  }
  const imgW = bitmap.width;
  const imgH = bitmap.height;

  // 2. Build a SQUARE canvas for MediaPipe — the WASM build warns on
  //    non-square inputs ("Using NORM_RECT without IMAGE_DIMENSIONS"),
  //    so we pad the image to the longer dimension with transparent
  //    bars and pass the square canvas instead. Landmarks come back in
  //    canvas-pixel coords, which we convert back to original-image
  //    coords by subtracting the pad offset.
  const side = Math.max(imgW, imgH);
  const padX = Math.floor((side - imgW) / 2);
  const padY = Math.floor((side - imgH) / 2);
  const mpCanvas = document.createElement("canvas");
  mpCanvas.width = side;
  mpCanvas.height = side;
  const mpCtx = mpCanvas.getContext("2d");
  if (!mpCtx) {
    bitmap.close();
    return skipped(performance.now() - start);
  }
  mpCtx.drawImage(bitmap, padX, padY);

  // 3. Kick off GroundingDINO detection and MediaPipe landmarks in parallel —
  //    they don't depend on each other. The detector needs the raw file bytes;
  //    MediaPipe gets the square canvas.
  const [detector, mp] = await Promise.all([
    detectRingApi(file),                                // server-side proxy
    Promise.resolve().then(async () => {
      const landmarker = await loadHandLandmarker();
      // Live AR may have switched the shared singleton to VIDEO mode.
      await setImageMode(landmarker);
      return landmarker.detect(mpCanvas);
    }),
  ]);

  // 3. If MediaPipe found no hand, still use model boxes directly. For
  //    stage demos this is valuable: it behaves like a recognisable object
  //    detector even when the hand landmark model cannot resolve the pose.
  if (!mp.landmarks || mp.landmarks.length === 0) {
    if (detector && detector.candidates.length > 0) {
      const candidates: DetectionCandidate[] = detector.candidates.map((c) => ({
        bbox: c.bbox,
        confidence: c.confidence,
        classLabel: c.class_label,
      }));
      const chosen = candidates[0]!;
      const cropped = await cropToBox(bitmap, chosen.bbox);
      bitmap.close();
      if (!cropped) {
        return skipped(performance.now() - start, {
          detectionSource: detector.source,
          detectorLabel: detector.model,
          candidates,
          chosenIdx: 0,
          bbox: chosen.bbox,
          detectionScore: chosen.confidence,
          imageWidth: imgW,
          imageHeight: imgH,
          detectionReason: "Detector found a ring region, but the crop was too small to use.",
        });
      }
      return {
        applied: true,
        detectionSource: detector.source,
        detectorLabel: detector.model,
        candidates,
        chosenIdx: 0,
        crop: cropped.file,
        cropUrl: cropped.url,
        bbox: chosen.bbox,
        detectionScore: chosen.confidence,
        imageWidth: imgW,
        imageHeight: imgH,
        latencyMs: Math.round(performance.now() - start),
        method: "MediaPipe Hands (browser)",
        detectionReason: "Ring detected by hosted object detector; hand landmarks were not available.",
      };
    }
    bitmap.close();
    return skipped(performance.now() - start, detector === null
      ? {
          detectionSource: "groundingdino",
          detectorLabel: "GroundingDINO ring detector unavailable",
          detectionUnavailable: true,
          detectionReason: "GroundingDINO could not run, so no ring box was produced.",
          imageWidth: imgW,
          imageHeight: imgH,
        }
      : {
          detectionSource: detector.source,
          detectorLabel: detector.model,
          detectionReason: "No ring box was returned for this photograph.",
          imageWidth: imgW,
          imageHeight: imgH,
        });
  }
  const lm = mp.landmarks[0];
  const handedness = mp.handednesses?.[0]?.[0]?.categoryName;
  const handednessScore = mp.handednesses?.[0]?.[0]?.score;
  // MediaPipe normalised coords are relative to the SQUARE padded canvas
  // (side × side). Convert to padded-pixel coords, then subtract the pad
  // offset so downstream code sees coords in the ORIGINAL image space.
  const landmarks: LandmarkPoint[] = lm.map((p) => ({
    x: p.x * side - padX,
    y: p.y * side - padY,
  }));

  // 4. Primary path — the detector returned at least one ring box. Model
  //    ranking can include large phrase-grounded boxes around fingers/hand.
  //    We filter against MediaPipe's hand region first: any detection whose
  //    centre falls outside the hand bbox is treated as a false positive.
  //    Among the on-hand candidates we rank by a combined score of
  //    confidence × (1 - normalised distance to the closest finger), so the
  //    pick is both confident AND actually next to a finger.
  if (detector && detector.candidates.length > 0) {
    const handBox = handBoundingBox(landmarks, 0.18);

    const scored = detector.candidates.map((c) => {
      const r = resolveFingerForBox(c.bbox, landmarks);
      const onHand = handBox ? bboxCentreInside(c.bbox, handBox) : true;
      // Combined score in [0, 1] — confidence weighted by how close the
      // bbox sits to a finger. Off-hand detections drop to a tiny score
      // so they only win if NO on-hand candidate exists.
      const resolutionConf = r?.resolutionConfidence ?? 0;
      const boxArea = c.bbox[2] * c.bbox[3];
      const handArea = handBox ? Math.max(1, handBox.w * handBox.h) : boxArea;
      const boxToHand = boxArea / handArea;
      // In hand scenes, GroundingDINO may return phrase boxes around an
      // entire finger/hand plus a smaller box on the ring. Penalise boxes
      // that are too large to be a worn band while keeping product-shot
      // whole-ring boxes untouched in the no-hand path above.
      const sizeScore = boxToHand <= 0.08 ? 1 : Math.max(0.08, 0.08 / boxToHand);
      const ranking = onHand
        ? c.confidence * (0.4 + 0.6 * resolutionConf) * sizeScore
        : c.confidence * 0.05;
      return {
        bbox: c.bbox as [number, number, number, number],
        confidence: c.confidence,
        finger: r?.finger,
        fingerIndex: r?.fingerIndex,
        classLabel: c.class_label,
        onHand,
        ranking,
      };
    });

    // Sort by ranking desc — best on-hand candidate first, then off-hand.
    scored.sort((a, b) => b.ranking - a.ranking);

    // If the top-ranked is OFF the hand, every detector box is treated as a
    // false positive. Do not guess locally; send the original photo onward.
    if (!scored[0].onHand) {
      console.warn(
        "[detector] All ring detections were off the hand — skipping auto-crop",
        scored.map((s) => ({ bbox: s.bbox, conf: s.confidence })),
      );
      bitmap.close();
      return skipped(performance.now() - start, {
        detectionSource: detector.source,
        detectorLabel: detector.model,
        candidates: scored.map((s) => ({
          bbox: s.bbox,
          confidence: s.confidence,
          finger: s.finger,
          fingerIndex: s.fingerIndex,
          classLabel: s.classLabel,
        })),
        chosenIdx: 0,
        bbox: scored[0].bbox,
        finger: scored[0].finger,
        fingerIndex: scored[0].fingerIndex,
        handedness,
        handednessScore,
        landmarks,
        detectionScore: scored[0].confidence,
        imageWidth: imgW,
        imageHeight: imgH,
        detectionReason: "Detector found ring-like regions, but none were on the hand.",
      });
    }
    {
      const candidates: DetectionCandidate[] = scored.map((s) => ({
        bbox: s.bbox,
        confidence: s.confidence,
        finger: s.finger,
        fingerIndex: s.fingerIndex,
        classLabel: s.classLabel,
      }));
      const chosen = candidates[0]!;
      const cropped = await cropToBox(bitmap, chosen.bbox);
      bitmap.close();
      if (!cropped) return skipped(performance.now() - start);
      return {
        applied: true,
        detectionSource: detector.source,
        detectorLabel: detector.model,
        candidates,
        chosenIdx: 0,
        crop: cropped.file,
        cropUrl: cropped.url,
        bbox: chosen.bbox,
        finger: chosen.finger,
        fingerIndex: chosen.fingerIndex,
        landmarks,
        handedness,
        handednessScore,
        detectionScore: chosen.confidence,
        noRingFound: false,
        imageWidth: imgW,
        imageHeight: imgH,
        latencyMs: Math.round(performance.now() - start),
        method: "MediaPipe Hands (browser)",
      };
    }
  }

  // 5. The model had no usable hand-region detections. Do not guess a ring
  //    box locally: the interview demo should show model detections only.
  //    MediaPipe landmarks remain useful for proving the hand was understood
  //    and for rejecting off-hand false positives.
  bitmap.close();
  return skipped(performance.now() - start, detector === null
    ? {
        detectionSource: "groundingdino",
        detectorLabel: "GroundingDINO ring detector unavailable",
        detectionUnavailable: true,
        detectionReason: "GroundingDINO could not run, so no ring box was produced.",
        landmarks,
        handedness,
        handednessScore,
        imageWidth: imgW,
        imageHeight: imgH,
      }
    : {
        detectionSource: detector.source,
        detectorLabel: detector.model,
        detectionReason: "No ring box was returned for this photograph.",
        landmarks,
        handedness,
        handednessScore,
        imageWidth: imgW,
        imageHeight: imgH,
      });
}

/** Crop the bitmap to the given bbox and return both a File and an ObjectURL. */
async function cropToBox(
  bitmap: ImageBitmap,
  bbox: [number, number, number, number],
): Promise<{ file: File; url: string } | null> {
  const [x, y, w, h] = bbox;
  if (w < 16 || h < 16) return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
  const blob: Blob | null = await new Promise((res) =>
    canvas.toBlob(res, "image/jpeg", 0.92),
  );
  if (!blob) return null;
  return {
    file: new File([blob], "ring-crop.jpg", { type: "image/jpeg" }),
    url: URL.createObjectURL(blob),
  };
}

/**
 * Public helper: re-crop the source File against a different candidate bbox
 * and return a new File the page can send to /api/identify. Used by the
 * click-to-correct UX in DetectionPanel.
 */
export async function recropForCandidate(
  file: File,
  bbox: [number, number, number, number],
): Promise<{ file: File; url: string } | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  try {
    return await cropToBox(bitmap, bbox);
  } finally {
    bitmap.close();
  }
}

/* --------------------------- pixel-based scoring -------------------------- */

type RGB = { r: number; g: number; b: number };

/** Pixel index in the RGBA Uint8ClampedArray. */
function idx(x: number, y: number, w: number): number {
  return (y * w + x) * 4;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Sample the hand's own skin tone from points that never coincide with where
 * a ring is worn. The MCP joints (5/9/13/17) are exactly where rings sit, so
 * sampling on them contaminates the reference with metal pixels and makes
 * ringed fingers look like skin. Use back-of-hand patches instead: the wrist
 * and the inter-knuckle valleys between adjacent MCPs, plus a palm-centre
 * point. A trimmed median (drop the top 15% of samples per channel) suppresses
 * any specular highlight that sneaks in.
 */
function sampleReferenceSkin(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  lm: Landmark[],
): RGB {
  const samplePoints: Array<{ x: number; y: number }> = [
    // Wrist.
    { x: lm[0].x * w, y: lm[0].y * h },
    // Inter-knuckle valleys between adjacent MCPs.
    midpoint(lm[5], lm[9], w, h),
    midpoint(lm[9], lm[13], w, h),
    midpoint(lm[13], lm[17], w, h),
    // Back of hand / palm centre — midway from wrist to middle-finger MCP.
    midpoint(lm[0], lm[9], w, h),
  ];

  const RS: number[] = [];
  const GS: number[] = [];
  const BS: number[] = [];
  for (const p of samplePoints) {
    const px0 = clamp(Math.round(p.x), 0, w - 1);
    const py0 = clamp(Math.round(p.y), 0, h - 1);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const sx = clamp(px0 + dx, 0, w - 1);
        const sy = clamp(py0 + dy, 0, h - 1);
        const i = idx(sx, sy, w);
        RS.push(px[i]);
        GS.push(px[i + 1]);
        BS.push(px[i + 2]);
      }
    }
  }
  return { r: trimmedMedian(RS), g: trimmedMedian(GS), b: trimmedMedian(BS) };
}

/** Midpoint between two normalised landmarks, returned in source-pixel coords. */
function midpoint(
  a: Landmark,
  b: Landmark,
  w: number,
  h: number,
): { x: number; y: number } {
  return { x: ((a.x + b.x) / 2) * w, y: ((a.y + b.y) / 2) * h };
}

/**
 * Median after dropping the top 15% of values — bright specular pixels
 * (metal, diamonds) would otherwise drag the median up and bleach the
 * reference toward whatever sneaks in.
 */
function trimmedMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const drop = Math.floor(sorted.length * 0.15);
  const kept = sorted.slice(0, sorted.length - drop);
  return kept[kept.length >> 1];
}

/**
 * Score a single finger by how unlike skin its proximal-phalanx region looks.
 * Rings sit at the bottom ~half of the MCP-PIP segment (right above the
 * knuckle), so we sample t in [0, 0.55] with a wider strip than before.
 * Max distance captures specular hits (diamonds); average distance picks up
 * solid coloured bands across the whole region.
 */
function fingerRingEvidence(
  px: Uint8ClampedArray,
  w: number,
  h: number,
  lm: Landmark[],
  mcpIdx: number,
  pipIdx: number,
  ref: RGB,
): number {
  const a = lm[mcpIdx];
  const b = lm[pipIdx];
  const ax = a.x * w;
  const ay = a.y * h;
  const bx = b.x * w;
  const by = b.y * h;

  // Perpendicular vector (unit-length) to the finger so we can sample a
  // strip with some width around the segment. Wider band (0.28x) catches
  // chunkier rings and absorbs slight MediaPipe landmark drift.
  let nx = -(by - ay);
  let ny = bx - ax;
  const nlen = Math.hypot(nx, ny) || 1;
  nx /= nlen;
  ny /= nlen;
  const halfBand = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) * 0.28));

  const STEPS = 10;           // along the proximal half only
  const ACROSS = 5;           // perpendicular samples per step
  const T_MAX = 0.55;         // stop sampling past mid-phalanx

  let maxDist = 0;
  let sumDist = 0;
  let n = 0;
  for (let i = 0; i < STEPS; i++) {
    const t = (i / (STEPS - 1)) * T_MAX;
    const cx = ax + (bx - ax) * t;
    const cy = ay + (by - ay) * t;
    for (let j = 0; j < ACROSS; j++) {
      const u = (j / (ACROSS - 1) - 0.5) * 2; // -1..1
      const sx = Math.round(clamp(cx + nx * u * halfBand, 0, w - 1));
      const sy = Math.round(clamp(cy + ny * u * halfBand, 0, h - 1));
      const p = idx(sx, sy, w);
      const dr = px[p] - ref.r;
      const dg = px[p + 1] - ref.g;
      const db = px[p + 2] - ref.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist > maxDist) maxDist = dist;
      sumDist += dist;
      n++;
    }
  }
  const avgDist = n > 0 ? sumDist / n : 0;
  return maxDist * 0.6 + avgDist * 0.4;
}

/* ----------------------------- finger picker ----------------------------- */

/**
 * Anatomical prior: rings are worn far more often on the ring or middle
 * finger than on the index or pinky, especially in the kind of catalogue /
 * portrait photography this demo handles. Applied only as a tiebreak nudge
 * on close evidence scores — it never overrides a clear winner.
 */
const FINGER_PRIOR: Record<FingerName, number> = {
  index: 0,
  middle: 6,
  ring: 12,
  pinky: -4,
};

function pickFinger(
  lm: Landmark[],
  imgW: number,
  imgH: number,
  pixels: Uint8ClampedArray,
  refSkin: RGB,
):
  | {
      name: FingerName;
      mcp: number;
      pip: number;
      segmentLen: number;
      /** Normalised in roughly [0, 1] — relative ring-evidence vs. peers. */
      detectionScore: number;
    }
  | null {
  // Compute (a) the MCP-PIP segment length per finger as a geometric sanity
  // check, and (b) the ring-evidence score from the pixel strip.
  const scored = FINGERS.map((f) => {
    const a = lm[f.mcp];
    const b = lm[f.pip];
    if (!a || !b) {
      return { ...f, segmentLen: 0, evidence: 0 };
    }
    const dx = (b.x - a.x) * imgW;
    const dy = (b.y - a.y) * imgH;
    const segmentLen = Math.hypot(dx, dy);
    const evidence =
      segmentLen >= 12
        ? fingerRingEvidence(pixels, imgW, imgH, lm, f.mcp, f.pip, refSkin)
        : 0;
    return { ...f, segmentLen, evidence };
  });

  // Anyone with a usable segment? If not, MediaPipe found the hand at a
  // pose so degenerate that we can't crop a sensible region.
  const usable = scored.filter((s) => s.segmentLen >= 12);
  if (usable.length === 0) return null;

  const maxEvidence = Math.max(...usable.map((s) => s.evidence));

  // If NO finger shows meaningful non-skin content, the hand isn't actually
  // wearing a ring. Fall back to the longest visible finger so the demo
  // still produces a sensible crop, and flag the result as no-ring via
  // detectionScore = 0.
  const RING_EVIDENCE_MIN = 38;
  if (maxEvidence < RING_EVIDENCE_MIN) {
    const longest = usable.reduce((a, c) => (c.segmentLen > a.segmentLen ? c : a));
    return {
      name: longest.name,
      mcp: longest.mcp,
      pip: longest.pip,
      segmentLen: longest.segmentLen,
      detectionScore: 0,
    };
  }

  // Rank by raw evidence first; we'll use the gap between #1 and #2 to
  // decide whether to apply the anatomical prior as a tiebreak.
  const ranked = [...usable].sort((a, b) => b.evidence - a.evidence);
  const top = ranked[0];
  const runnerUp = ranked[1];

  // Margin check: if the top score doesn't beat the runner-up by either
  // 15% relative or 20 absolute, treat them as a tie and let the prior
  // pick between the top two. This stops near-ties from going to the
  // index just because it scored a hair above ring.
  let best = top;
  if (runnerUp) {
    const absMargin = top.evidence - runnerUp.evidence;
    const relMargin = runnerUp.evidence > 0 ? absMargin / runnerUp.evidence : 1;
    const decisive = relMargin >= 0.15 || absMargin >= 20;
    if (!decisive) {
      const topPrior = top.evidence + FINGER_PRIOR[top.name];
      const runnerPrior = runnerUp.evidence + FINGER_PRIOR[runnerUp.name];
      if (runnerPrior > topPrior) best = runnerUp;
    }
  }

  const detectionScore = Math.min(1, best.evidence / 180);

  return {
    name: best.name,
    mcp: best.mcp,
    pip: best.pip,
    segmentLen: best.segmentLen,
    detectionScore,
  };
}

function ringBox(
  lm: Landmark[],
  mcpIdx: number,
  pipIdx: number,
  imgW: number,
  imgH: number,
): [number, number, number, number] | null {
  const mcp = lm[mcpIdx];
  const pip = lm[pipIdx];
  if (!mcp || !pip) return null;

  const cx = ((mcp.x + pip.x) / 2) * imgW;
  const cy = ((mcp.y + pip.y) / 2) * imgH;

  // Crop side ~= 1.6× the MCP-PIP segment length. Slightly larger than the
  // finger thickness so we get the whole band plus a little air for context.
  const segLen = Math.hypot((pip.x - mcp.x) * imgW, (pip.y - mcp.y) * imgH);
  const side = Math.max(64, Math.round(segLen * 1.6));

  let x = Math.round(cx - side / 2);
  let y = Math.round(cy - side / 2);
  let w = side;
  let h = side;

  // Clamp inside the image so the canvas crop is well-defined.
  if (x < 0) {
    w += x;
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (x + w > imgW) w = imgW - x;
  if (y + h > imgH) h = imgH - y;
  if (w < 32 || h < 32) return null;

  return [x, y, w, h];
}
