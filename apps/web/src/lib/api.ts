export type IdentifyMatch = {
  label: string;
  similarity: number;
  source_path: string;
};

export type ClassScore = {
  label: string;
  mean_similarity: number;
  count: number;
};

export type IdentifyResult = {
  /** Back-compat: set to predicted_class iff above threshold, else null. */
  ring_id: string | null;
  /** Top accepted class, or raw best class when no match passes threshold. */
  predicted_class: string;
  /** Mean cosine for `predicted_class`; below threshold when no match is accepted. */
  confidence: number;
  /** confidence >= threshold (applied server-side). */
  is_confident: boolean;
  /** Threshold the server applied after clamping. */
  threshold: number;
  /** top_k actually used after clamping (≥1, ≤ gallery size). */
  top_k_requested: number;
  /** Ranked gallery neighbours that passed the active threshold. */
  top_k: IdentifyMatch[];
  /** Per-class mean cosine over accepted neighbours, sorted descending. */
  class_scores: ClassScore[];
  latency_ms: number;
};

/** Operator-tunable settings for /api/identify. */
export type IdentifyOptions = {
  /** Cosine cutoff in [0.0, 1.0] for "confident" matches. */
  threshold?: number;
  /** Number of nearest neighbours to return (1–25). */
  topK?: number;
};

/**
 * Client-side detection metadata attached to the result by page.tsx.
 * Does NOT come from the API — produced by lib/detector.ts before identify().
 */
/** One candidate detection rendered in the overlay. */
export type DetectionCandidate = {
  bbox: [number, number, number, number];     // top-left x, y, w, h, source px
  confidence: number;                          // 0..1
  finger?: string;                             // resolved via MediaPipe landmarks
  fingerIndex?: number;
  classLabel?: string;                         // model-side class name ("Ring")
};

export type DetectionSource = "groundingdino";

export type DetectionMeta = {
  applied: boolean;
  /** Which detector produced the result we're showing. */
  detectionSource?: DetectionSource;
  /** Friendly model id, e.g. "IDEA-Research/grounding-dino-tiny". */
  detectorLabel?: string;
  /** True when the hosted detector could not run, so the UI can explain it. */
  detectionUnavailable?: boolean;
  /** Human-readable detector status for demo copy and diagnostics. */
  detectionReason?: string;
  /** All candidates above threshold. The "chosen" one is at index `chosenIdx`. */
  candidates?: DetectionCandidate[];
  chosenIdx?: number;

  finger?: string;
  fingerIndex?: number;
  handedness?: string;
  handednessScore?: number;
  /** Detector's own confidence (0..1) for the chosen candidate. */
  detectionScore?: number;
  /** True when no finger met the ring-evidence threshold — best-guess crop. */
  noRingFound?: boolean;
  bbox?: [number, number, number, number];
  /** 21 MediaPipe Hand landmarks in source-pixel coords, for the overlay. */
  landmarks?: { x: number; y: number }[];
  imageWidth?: number;
  imageHeight?: number;
  latencyMs: number;
  method: "MediaPipe Hands (browser)";
};

/* ---------- Server-side GroundingDINO detector --------------------------- */

export type DetectRingResponse = {
  candidates: Array<{
    bbox: [number, number, number, number];
    confidence: number;
    class_label: string;
  }>;
  image_width: number;
  image_height: number;
  model: string;
  latency_ms: number;
  source: "groundingdino";
};

/**
 * Calls our FastAPI detector endpoint. The backend runs GroundingDINO locally
 * and returns ring boxes; MediaPipe in the browser is only used to reject
 * off-hand boxes and label the finger.
 */
export async function detectRing(file: File): Promise<DetectRingResponse | null> {
  const form = new FormData();
  form.append("image", file);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/detect-ring`, { method: "POST", body: form });
  } catch {
    return null;
  }
  if (res.status === 503) return null;
  if (!res.ok) return null;
  return (await res.json()) as DetectRingResponse;
}

/** Same-origin in dev (Next rewrites /api → FastAPI). Override for remote API. */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export async function identifyRing(
  file: File,
  options: IdentifyOptions = {},
): Promise<IdentifyResult> {
  const form = new FormData();
  form.append("image", file);
  if (typeof options.threshold === "number" && Number.isFinite(options.threshold)) {
    form.append("threshold", String(options.threshold));
  }
  if (typeof options.topK === "number" && Number.isFinite(options.topK)) {
    form.append("top_k", String(Math.round(options.topK)));
  }
  const res = await fetch(`${API_BASE}/api/identify`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`identify failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as IdentifyResult;
}

export type HealthResult = {
  status: string;
  encoder: string;
  gallery_size: number;
  classes: string[];
  boot_seconds: number;
};

export async function getHealth(): Promise<HealthResult> {
  const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`health failed (${res.status})`);
  return (await res.json()) as HealthResult;
}

/* ---------- Attribute extraction (Module 2 / Analyse) ------------------- */

export type AttributeCandidate = {
  label: string;
  score: number;
};

export type AttributeGroup = {
  key: string;
  title: string;
  top: string;
  candidates: AttributeCandidate[];
};

export type AnalyseResult = {
  attributes: AttributeGroup[];
  latency_ms: number;
  model: string;
  device: string;
  prompt_count: number;
};

export async function analyseRing(file: File): Promise<AnalyseResult> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${API_BASE}/api/analyse`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new Error(`analyse failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as AnalyseResult;
}

/** Build a URL to the safe reference-image proxy. */
export function referenceImageUrl(path: string): string {
  return `${API_BASE}/api/reference-image?path=${encodeURIComponent(path)}`;
}

/**
 * Fetch a reference image as a File, ready to feed back into identifyRing().
 * Used by the one-click sample picks on the demo page.
 */
export async function fetchReferenceAsFile(path: string, filename: string): Promise<File> {
  const res = await fetch(referenceImageUrl(path));
  if (!res.ok) throw new Error(`reference fetch failed (${res.status})`);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}
