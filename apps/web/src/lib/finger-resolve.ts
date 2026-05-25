/**
 * Given a detector ring bbox and the 21 MediaPipe hand landmarks (all in
 * source-pixel coords), return the most plausible finger that wears it.
 *
 * Scoring rule (each finger gets a score; lowest wins):
 *   score = min(dist_to_MCP-PIP, dist_to_MCP-DIP, dist_to_PIP-DIP)
 *
 * Using the whole proximal+middle phalanx gives the detector more leeway
 * than the MCP-PIP segment alone: a ring detected anywhere along a finger
 * still resolves to that finger. We NEVER return null — if MediaPipe gave
 * us a hand, we always assign the bbox to its closest finger and let the
 * UI surface the confidence separately. False rejection is much more
 * painful in practice than a slightly-wrong finger label.
 *
 * Pure geometry — no canvas reads, no DOM, easy to unit test.
 */

export type LandmarkPt = { x: number; y: number };

export const RING_FINGERS = [
  { name: "index", mcp: 5, pip: 6, dip: 7 },
  { name: "middle", mcp: 9, pip: 10, dip: 11 },
  { name: "ring", mcp: 13, pip: 14, dip: 15 },
  { name: "pinky", mcp: 17, pip: 18, dip: 19 },
] as const;

export type FingerName = (typeof RING_FINGERS)[number]["name"];

export type FingerResolution = {
  finger: FingerName;
  fingerIndex: number;          // 0..3 in RING_FINGERS order
  distance: number;             // closest distance from bbox centre to finger
  segmentLength: number;        // MCP-PIP segment length, for sanity
  /**
   * "confidence" the bbox actually sits on this finger. 1.0 when the bbox
   * centre lies on the finger segments; falls off smoothly as the box
   * drifts away. Use this in the UI to decide whether to show a
   * "(uncertain)" qualifier next to the finger name.
   */
  resolutionConfidence: number;
};

export function resolveFingerForBox(
  bbox: [number, number, number, number],
  landmarks: LandmarkPt[],
): FingerResolution | null {
  if (!landmarks || landmarks.length < 21) return null;

  const [x, y, w, h] = bbox;
  const cx = x + w / 2;
  const cy = y + h / 2;

  let best: FingerResolution | null = null;
  for (let i = 0; i < RING_FINGERS.length; i++) {
    const f = RING_FINGERS[i];
    const lm0 = landmarks[f.mcp];
    const lm1 = landmarks[f.pip];
    const lm2 = landmarks[f.dip];
    if (!lm0 || !lm1 || !lm2) continue;

    const segLen = Math.hypot(lm1.x - lm0.x, lm1.y - lm0.y);
    if (segLen < 6) continue;

    // Distance from bbox centre to any of the three finger segments — pick
    // the smallest. Rings can sit anywhere from the proximal phalanx down
    // to the middle phalanx; this lets the detector hit any of those.
    const d = Math.min(
      pointToSegmentDistance(cx, cy, lm0.x, lm0.y, lm1.x, lm1.y),
      pointToSegmentDistance(cx, cy, lm0.x, lm0.y, lm2.x, lm2.y),
      pointToSegmentDistance(cx, cy, lm1.x, lm1.y, lm2.x, lm2.y),
    );

    if (!best || d < best.distance) {
      best = {
        finger: f.name,
        fingerIndex: i,
        distance: d,
        segmentLength: segLen,
        // Will be normalised below once we know the overall scale.
        resolutionConfidence: 0,
      };
    }
  }
  if (!best) return null;

  // Confidence falls off over ~2× segment length. Inside the finger = 1.0,
  // 2 segment-lengths away ≈ 0.0. Clamped to [0, 1].
  const drop = best.distance / Math.max(1, best.segmentLength * 2);
  best.resolutionConfidence = Math.max(0, Math.min(1, 1 - drop));
  return best;
}

/**
 * Compute an axis-aligned bbox around all 21 hand landmarks, padded by a
 * fraction of the longest finger so the box catches the tips of rings that
 * sit at the very edge of the finger.
 */
export function handBoundingBox(
  landmarks: LandmarkPt[],
  paddingFraction = 0.18,
): { x: number; y: number; w: number; h: number } | null {
  if (!landmarks || landmarks.length < 21) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) return null;
  const w = maxX - minX;
  const h = maxY - minY;
  const padX = w * paddingFraction;
  const padY = h * paddingFraction;
  return {
    x: minX - padX,
    y: minY - padY,
    w: w + 2 * padX,
    h: h + 2 * padY,
  };
}

/** True if the centre of `bbox` falls inside `region`. */
export function bboxCentreInside(
  bbox: [number, number, number, number],
  region: { x: number; y: number; w: number; h: number },
): boolean {
  const cx = bbox[0] + bbox[2] / 2;
  const cy = bbox[1] + bbox[3] / 2;
  return (
    cx >= region.x &&
    cx <= region.x + region.w &&
    cy >= region.y &&
    cy <= region.y + region.h
  );
}

/** Shortest distance from point (px, py) to segment (ax, ay)-(bx, by). */
function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}
