/**
 * Cached MediaPipe HandLandmarker loader.
 *
 * The WASM bundle and the .task model file are ~10-12 MB combined, so we
 * lazy-load once per session and keep the singleton around. The model
 * itself is the same `hand_landmarker.task` Google publishes for the web
 * recipe (https://developers.google.com/mediapipe/solutions/vision/hand_landmarker/web_js).
 *
 * We deliberately use the CDN-hosted model file rather than vendoring it
 * into /public — Next.js dev rebuilds choke on 12 MB binaries and the
 * model is content-addressed so we don't need to version it ourselves.
 */
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

/**
 * MediaPipe Tasks Vision pipes glog-format WASM diagnostics through
 * console.warn / console.log on every frame. Next.js dev forwards those
 * into the integrated terminal, which grows without bound during webcam /
 * detection sessions. Filter once per tab so only actionable messages pass.
 */
function installMediaPipeLogFilter(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __hmMpFiltered?: boolean };
  if (w.__hmMpFiltered) return;
  w.__hmMpFiltered = true;

  const PATTERNS = [
    /OpenGL error checking is disabled/i,
    /Using NORM_RECT without IMAGE_DIMENSIONS/i,
    /landmark_projection_calculator\.cc/i,
    /gl_context\.cc/i,
    /W\d{4}\s+\d{2}:\d{2}:\d{2}/, // glog timestamp prefix
    /Graph finished closing/i,
    /Created TensorFlow Lite/i,
  ];
  const shouldSilence = (args: unknown[]): boolean =>
    args.some(
      (a) => typeof a === "string" && PATTERNS.some((p) => p.test(a)),
    );

  const origWarn = console.warn.bind(console);
  const origLog = console.log.bind(console);
  const origError = console.error.bind(console);
  console.warn = (...args: unknown[]) => {
    if (shouldSilence(args)) return;
    origWarn(...args);
  };
  console.log = (...args: unknown[]) => {
    if (shouldSilence(args)) return;
    origLog(...args);
  };
  console.error = (...args: unknown[]) => {
    if (shouldSilence(args)) return;
    origError(...args);
  };
}

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let cached: HandLandmarker | null = null;
let inflight: Promise<HandLandmarker> | null = null;

/**
 * Load (or return the cached) HandLandmarker tuned for static images.
 *
 * The same instance is reused for video frames by callers that switch
 * its running mode in-place via `setOptions`.
 */
export async function loadHandLandmarker(): Promise<HandLandmarker> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    installMediaPipeLogFilter();
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
    const lm = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      numHands: 1,
      runningMode: "IMAGE",
      // The defaults (0.5 / 0.5 / 0.5) are tuned for gesture recognition;
      // for static product try-on we want to be a little more conservative
      // on detection so we don't fire on partial hands.
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    cached = lm;
    return lm;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Switch the underlying landmarker to VIDEO mode (idempotent) so the
 * caller can invoke detectForVideo() in a render loop.
 */
export async function setVideoMode(lm: HandLandmarker): Promise<void> {
  await lm.setOptions({ runningMode: "VIDEO" });
}

export async function setImageMode(lm: HandLandmarker): Promise<void> {
  await lm.setOptions({ runningMode: "IMAGE" });
}

export type { HandLandmarkerResult };
