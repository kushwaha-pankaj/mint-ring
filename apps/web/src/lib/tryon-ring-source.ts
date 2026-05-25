/**
 * Resolve the ring image to try on.
 *
 * Only explicit handoffs (?job_id= / ?design=) from Design results or Gallery.
 * Workspace state is not persisted; finished packs live in /gallery.
 *
 * Always returns a real URL (absolute or API-relative) — never a stub.
 */

import { assetUrl, getJob, type JobSnapshot } from "./design-api";

export type RingSource = {
  jobId: string;
  designId: string;
  /** Fully resolved URL to the hero (photoreal product render). */
  ringImageUrl: string;
  /** Best-effort thumbnail (falls back to hero if no sketch). */
  sketchUrl: string | null;
  /**
   * Fully resolved URL to the textured GLB mesh from the design pack, if
   * the mesh stage finished. Null when the pack has no 3D output — Live
   * AR is disabled in that case.
   */
  meshUrl: string | null;
  origin: "url-param";
};

function readJobIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  // Accept both `job_id` (canonical) and `design` (shorter share-friendly alias).
  return params.get("job_id") || params.get("design") || null;
}

function pickHeroUrl(job: JobSnapshot): string | null {
  const hero = job.stages?.hero;
  if (hero?.asset_url) return assetUrl(hero.asset_url);
  // Fallback: if the operator skipped hero but kept angles, pick the
  // 45-degree shot — that's closest to a product hero.
  const angles = job.stages?.angles?.angle_urls;
  if (Array.isArray(angles) && angles.length > 0) {
    const fortyFive = angles.find((a) => Math.round((a as { degrees?: number }).degrees ?? 0) === 45);
    const chosen = fortyFive ?? angles[0];
    const url = (chosen as { url?: string }).url;
    if (url) return assetUrl(url);
  }
  return null;
}

function pickSketchUrl(job: JobSnapshot): string | null {
  const sketch = job.stages?.sketch;
  if (sketch?.asset_url) return assetUrl(sketch.asset_url);
  return null;
}

function pickMeshUrl(job: JobSnapshot): string | null {
  const mesh = job.stages?.mesh;
  if (mesh?.status === "done" && mesh.asset_url) {
    return assetUrl(mesh.asset_url);
  }
  return null;
}

export async function resolveRingSource(): Promise<RingSource | null> {
  const jobId = readJobIdFromUrl();
  if (!jobId) return null;

  let job: JobSnapshot;
  try {
    job = await getJob(jobId);
  } catch {
    return null;
  }

  // Only accept jobs that actually completed — half-finished jobs may have
  // a pending/failed hero stage we don't want to try-on against.
  if (job.status !== "succeeded") {
    // For the in-progress case the page can re-poll; the *resolved* source
    // still needs a finished hero, so we treat it as null.
    if (!pickHeroUrl(job)) return null;
  }

  const ringImageUrl = pickHeroUrl(job);
  if (!ringImageUrl) return null;

  return {
    jobId: job.job_id,
    designId: job.design_id,
    ringImageUrl,
    sketchUrl: pickSketchUrl(job),
    meshUrl: pickMeshUrl(job),
    origin: "url-param",
  };
}
