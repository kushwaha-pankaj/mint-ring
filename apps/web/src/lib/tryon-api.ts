/**
 * Typed client for /api/tryon/*.
 *
 * Generate uses FLUX.1 Kontext [pro] Multi server-side:
 *   image_urls[0] = the user's hand photo (uploaded here)
 *   image_urls[1] = the ring asset (server reads from disk via ring_image_url)
 *
 * The browser does NOT pre-composite the ring onto the hand. Pasting a
 * top-down ring product photo on a finger as a sticker looks like a
 * sticker. FLUX renders the band wrapping the finger natively.
 */

import { hmFetch } from "./hm-fetch";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type TryOnHealth = {
  status: "ok";
  engine: string | null;
  supports_multi_edit: boolean;
  max_edge_px: number;
  max_upload_bytes: number;
};

export type GenerateResponse = {
  render_id: string;
  url: string;
  engine: string;
  seed: number;
  latency_ms: number;
  image_size: { width: number; height: number };
};

export class TryOnApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function asError(res: Response): Promise<TryOnApiError> {
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
  return new TryOnApiError(detail, res.status, code);
}

export async function getTryOnHealth(): Promise<TryOnHealth> {
  const res = await hmFetch(`${API_BASE}/api/tryon/health`, { cache: "no-store" });
  if (!res.ok) throw await asError(res);
  return (await res.json()) as TryOnHealth;
}

/**
 * Submit a hand photo plus the URL of an internal ring asset (a hero
 * render from /design or a previous try-on result). Server fetches the
 * ring from its own disk; the URL is treated as a routing pointer, not
 * an open redirect.
 */
export async function generateTryOn(
  handImage: Blob,
  ringImageUrl: string,
  opts: { handFilename?: string; seed?: number } = {},
): Promise<GenerateResponse> {
  const form = new FormData();
  form.append(
    "hand_image",
    handImage,
    opts.handFilename ?? "hand.jpg",
  );
  form.append("ring_image_url", ringImageUrl);
  if (typeof opts.seed === "number" && opts.seed > 0) {
    form.append("seed", String(opts.seed));
  }
  const res = await hmFetch(`${API_BASE}/api/tryon/generate`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw await asError(res);
  return (await res.json()) as GenerateResponse;
}

export function tryOnAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}
