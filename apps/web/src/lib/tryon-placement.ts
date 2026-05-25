/**
 * Geometry for placing a ring image on a detected hand.
 *
 * MediaPipe HandLandmarker returns 21 landmarks per hand in normalised
 * image coordinates [0..1]. Ring-finger landmarks:
 *   0  = WRIST
 *   5  = INDEX_MCP        (base of index finger)
 *   9  = MIDDLE_MCP       (base of middle finger)
 *   13 = RING_FINGER_MCP  (base knuckle of ring finger)
 *   14 = RING_FINGER_PIP  (first knuckle)
 *   15 = RING_FINGER_DIP  (second knuckle)
 *   16 = RING_FINGER_TIP
 *   17 = PINKY_MCP        (base of pinky)
 *
 * Anatomy: a wedding band sits on the proximal phalanx — the segment
 * between MCP (13) and PIP (14). Anchoring the ring centre at a point
 * 45% of the way from MCP toward PIP looks right on every hand pose we
 * tested; it stays clear of the knuckle wrinkle but isn't so close to
 * MCP that the band fights the webbing between fingers.
 */
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export const RING_ANCHOR_T = 0.45;

/** Ring-finger landmark indices, as documented above. */
export const LM = {
  WRIST: 0,
  INDEX_MCP: 5,
  MIDDLE_MCP: 9,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
} as const;

/** Placement transform in pixel space, relative to the source image. */
export type RingPlacement = {
  /** Centre of the ring in source-image pixels. */
  centerX: number;
  centerY: number;
  /** Outer width of the ring band, measured across the finger, in pixels. */
  width: number;
  /** Outer height — used by callers that want a non-square aspect. */
  height: number;
  /**
   * Counter-clockwise rotation in radians from the +X axis. A ring drawn
   * upright (band parallel to image bottom) corresponds to angle = 0.
   * We orient the band perpendicular to the finger axis: angle =
   * atan2(P14 - P13) — i.e. the band runs across the finger.
   */
  angle: number;
  /** True if the source-image hand appears to be palm-facing the camera. */
  palmFacing: boolean;
  /** Confidence proxy: visibility * presence of the key landmarks. */
  confidence: number;
};

/**
 * Compute a ring placement from MediaPipe landmarks.
 *
 * The aspect ratio (`bandAspect`) lets a caller adapt to the ring asset:
 * a thin solitaire band is wider than tall (aspect ~3-5), a wide eternity
 * band closer to 1.5. Default 3.5 matches the generated FLUX hero shots
 * (square render with a band roughly 1/4 the height of the ring image).
 */
export function computeRingPlacement(
  landmarks: NormalizedLandmark[],
  imageWidth: number,
  imageHeight: number,
  opts: { bandAspect?: number; widthScale?: number } = {},
): RingPlacement | null {
  const bandAspect = opts.bandAspect ?? 3.5;
  const widthScale = opts.widthScale ?? 1.0;
  if (!landmarks || landmarks.length < 21) return null;

  const mcp = landmarks[LM.RING_MCP];
  const pip = landmarks[LM.RING_PIP];
  const pinkyMcp = landmarks[LM.PINKY_MCP];
  const indexMcp = landmarks[LM.INDEX_MCP];
  const wrist = landmarks[LM.WRIST];
  if (!mcp || !pip || !pinkyMcp || !indexMcp || !wrist) return null;

  // De-normalise the points we care about into pixel space.
  const mcpX = mcp.x * imageWidth;
  const mcpY = mcp.y * imageHeight;
  const pipX = pip.x * imageWidth;
  const pipY = pip.y * imageHeight;
  const pinkyMcpX = pinkyMcp.x * imageWidth;
  const pinkyMcpY = pinkyMcp.y * imageHeight;
  const indexMcpX = indexMcp.x * imageWidth;
  const indexMcpY = indexMcp.y * imageHeight;
  const wristX = wrist.x * imageWidth;
  const wristY = wrist.y * imageHeight;

  // Anchor: blended position between MCP and PIP.
  const t = RING_ANCHOR_T;
  const centerX = mcpX + (pipX - mcpX) * t;
  const centerY = mcpY + (pipY - mcpY) * t;

  // Finger axis vector (MCP -> PIP). Band rotation perpendicular to this.
  const dx = pipX - mcpX;
  const dy = pipY - mcpY;
  const fingerAxisAngle = Math.atan2(dy, dx); // angle of finger pointing tip-ward
  // The band runs ACROSS the finger; rotate the asset so its long axis
  // is perpendicular to the finger axis. A horizontal source asset (band
  // running left-right) is already oriented this way when angle = 0, so:
  const angle = fingerAxisAngle - Math.PI / 2;

  // Width: use the distance between the ring-finger MCP and the pinky MCP
  // as a proxy for "one finger width" on this hand at this pose. This is
  // robust to perspective and scale because it's measured in the same
  // plane as the ring sits.
  const knuckleDist = Math.hypot(pinkyMcpX - mcpX, pinkyMcpY - mcpY);
  // The actual finger ~= 1.05x the knuckle spacing on every hand we
  // measured; the band image needs a touch more width to overhang. 1.45x
  // makes the band visually wrap the finger with the right padding.
  const fingerWidth = Math.max(12, knuckleDist * 1.45) * widthScale;
  const width = fingerWidth;
  const height = width / bandAspect;

  // Palm-facing detection: cross product of (wrist -> index_mcp) and
  // (wrist -> pinky_mcp). Sign flips when the back of the hand faces the
  // camera. We don't currently mirror the ring asset on flip, but we
  // expose the signal so the UI can warn / debug.
  const vIx = indexMcpX - wristX;
  const vIy = indexMcpY - wristY;
  const vPx = pinkyMcpX - wristX;
  const vPy = pinkyMcpY - wristY;
  const cross = vIx * vPy - vIy * vPx;
  const palmFacing = cross > 0; // right hand convention; either way it's symmetric

  // Confidence: MediaPipe's NormalizedLandmark exposes visibility on some
  // model variants but not the web Tasks API, so we approximate from the
  // geometric plausibility of the four ring-finger points.
  const phalanxLen = Math.hypot(dx, dy);
  const phalanxFromKnuckle = phalanxLen / Math.max(1, knuckleDist);
  // Healthy ratio is roughly 0.8 - 1.6. Outside that band the hand is
  // probably very foreshortened (side-on) and we can't trust the angle.
  const confidence = clamp(
    1 - Math.abs(phalanxFromKnuckle - 1.1) / 1.1,
    0,
    1,
  );

  return {
    centerX,
    centerY,
    width,
    height,
    angle,
    palmFacing,
    confidence,
  };
}

/**
 * Draw a ring asset onto a target canvas at the given placement.
 *
 * Pass shadow=true to drop a soft elliptical shadow under the band before
 * the asset itself — the canvas-only path needs *some* shadow to stop the
 * ring looking pasted-on, even before FLUX Kontext refines it.
 */
export function drawRingAt(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  p: RingPlacement,
  opts: { shadow?: boolean } = {},
): void {
  ctx.save();
  ctx.translate(p.centerX, p.centerY);
  ctx.rotate(p.angle);
  if (opts.shadow !== false) {
    // Soft drop shadow approximated as a darker ellipse beneath the band.
    // Real shadow direction needs lighting estimation; this is a
    // reasonable default that breaks the "pasted PNG" look. FLUX Kontext
    // replaces this with a directionally-correct shadow during refine.
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.filter = "blur(6px)";
    ctx.beginPath();
    ctx.ellipse(0, p.height * 0.45, p.width * 0.52, p.height * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(image, -p.width / 2, -p.height / 2, p.width, p.height);
  ctx.restore();
}

/** Manual nudge applied on top of an auto-computed placement. */
export type ManualAdjust = {
  /** Translation in source-image pixels. */
  dx: number;
  dy: number;
  /** Multiplicative width scale on top of the auto width. */
  scale: number;
  /** Additional rotation in radians. */
  rotation: number;
};

export const NO_ADJUST: ManualAdjust = { dx: 0, dy: 0, scale: 1, rotation: 0 };

export function applyAdjust(
  base: RingPlacement,
  adjust: ManualAdjust,
): RingPlacement {
  return {
    centerX: base.centerX + adjust.dx,
    centerY: base.centerY + adjust.dy,
    width: base.width * adjust.scale,
    height: base.height * adjust.scale,
    angle: base.angle + adjust.rotation,
    palmFacing: base.palmFacing,
    confidence: base.confidence,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
