/**
 * Typed client for /api/design/* — separate from lib/api.ts so the identify
 * + analyse code paths stay unchanged. Spec: docs/DESIGN_PAGE.md.
 */

import type { DesignBrief, OutputPackId } from "./design-brief";
import { hmFetch } from "./hm-fetch";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type AttributeCandidate = { label: string; score: number };
export type AttributeGroup = {
  key: string;
  title: string;
  top: string;
  candidates: AttributeCandidate[];
};

export type InspirationUpload = {
  upload_id: string;
  filename: string;
  url: string;
  attributes: AttributeGroup[];
};

export type StageStatus =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "failed";

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type StageState = {
  status: StageStatus;
  asset_url: string | null;
  angle_urls:
    | { label: string; degrees: number; url: string }[]
    | null;
  lighting_urls:
    | { label: string; url: string; tint?: string }[]
    | null;
  spec_rows: { key: string; value: string }[] | null;
  progress_completed: number;
  progress_total: number;
  progress_label: string | null;
  started_at: number | null;
  duration_estimate_s: number | null;
  error_code: string | null;
  error_message: string | null;
};

export type JobSnapshot = {
  job_id: string;
  design_id: string;
  status: JobStatus;
  current_stage: string | null;
  stages: Record<OutputPackId, StageState>;
  prompt: string;
  sketch_prompt: string;
  inspiration_attrs: AttributeGroup[];
  error_code: string | null;
  error_message: string | null;
  engine: string;
  latency_ms: number;
  created_at: number;
  updated_at: number;
};

export type StartGenerationResponse = {
  job_id: string;
  design_id: string;
  status: JobStatus;
};

export class DesignApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function asError(res: Response): Promise<DesignApiError> {
  let detail = res.statusText;
  let code: string | undefined;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") {
      detail = body.detail;
    } else if (typeof body?.detail === "object" && body.detail) {
      detail = body.detail.message ?? JSON.stringify(body.detail);
      code = body.detail.code;
    }
  } catch {
    /* ignore */
  }
  return new DesignApiError(detail, res.status, code);
}

export async function uploadInspiration(file: File): Promise<InspirationUpload> {
  const form = new FormData();
  form.append("image", file);
  const res = await hmFetch(`${API_BASE}/api/design/uploads`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw await asError(res);
  return (await res.json()) as InspirationUpload;
}

export async function deleteInspiration(uploadId: string): Promise<void> {
  const res = await hmFetch(`${API_BASE}/api/design/uploads/${uploadId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) throw await asError(res);
}

export async function resetDesignSession(): Promise<void> {
  const res = await hmFetch(`${API_BASE}/api/design/session`, {
    method: "DELETE",
  });
  if (!res.ok) throw await asError(res);
}

export async function startGeneration(
  brief: DesignBrief,
): Promise<StartGenerationResponse> {
  const res = await hmFetch(`${API_BASE}/api/design/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brief: briefForApi(brief) }),
  });
  if (!res.ok) throw await asError(res);
  return (await res.json()) as StartGenerationResponse;
}

export async function getJob(jobId: string): Promise<JobSnapshot> {
  const res = await hmFetch(`${API_BASE}/api/design/generate/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw await asError(res);
  return (await res.json()) as JobSnapshot;
}

export async function cancelGeneration(jobId: string): Promise<void> {
  const res = await hmFetch(`${API_BASE}/api/design/generate/${jobId}/cancel`, {
    method: "POST",
  });
  // 409 means already-terminal — acceptable on cancel.
  if (!res.ok && res.status !== 409 && res.status !== 404) {
    throw await asError(res);
  }
}

export function assetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}

/** Strip frontend-only fields (the embedded inspirationUploads array) and
 * project to the shape /api/design/generate expects. */
export function briefForApi(brief: DesignBrief): Record<string, unknown> {
  const inspirationUploadIds = (brief.inspirationUploads ?? []).map(
    (i) => i.upload_id,
  );
  return {
    ringType: brief.ringType,
    metal: brief.metal,
    setting: brief.setting,
    stone: brief.stone,
    band: brief.band,
    bandStyle: brief.bandStyle,
    finish: brief.finish,
    mood: brief.mood,
    moods: brief.moods,
    optionalDetails: brief.optionalDetails,
    notes: brief.notes,
    outputPack: brief.outputPack,
    inspirationUploadIds,
  };
}
