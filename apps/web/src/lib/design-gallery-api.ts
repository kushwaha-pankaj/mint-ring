import { assetUrl } from "./design-api";
import { hmFetch } from "./hm-fetch";
import { tryOnAssetUrl } from "./tryon-api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type GalleryAsset = {
  filename: string;
  url: string;
  caption: string;
  degrees?: number | null;
  media_type: string;
};

export type GallerySection = {
  id: string;
  label: string;
  items: GalleryAsset[];
  spec_rows?: { key: string; value: string }[];
};

export type GalleryDesign = {
  job_id: string;
  design_id: string;
  title: string;
  status: string;
  created_at: number;
  sections: GallerySection[];
  href: string;
};

export type GalleryTryOn = {
  render_id: string;
  title: string;
  url: string;
  created_at: number;
};

/** One calendar day of saved studio output (newest dates first). */
export type GalleryDateGroup = {
  date_key: string;
  date_label: string;
  design_count: number;
  tryon_count: number;
  designs: GalleryDesign[];
  tryons: GalleryTryOn[];
};

export type GalleryResponse = {
  range_label: string;
  date_label: string;
  design_count: number;
  tryon_count: number;
  groups: GalleryDateGroup[];
  designs: GalleryDesign[];
  tryons: GalleryTryOn[];
};

function dateKeyFromTs(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Build date groups client-side when an older API omits `groups`. */
export function galleryGroupsFromResponse(data: GalleryResponse): GalleryDateGroup[] {
  if (data.groups?.length) return data.groups;

  const buckets = new Map<string, GalleryDateGroup>();
  for (const design of data.designs) {
    const key = dateKeyFromTs(design.created_at);
    let group = buckets.get(key);
    if (!group) {
      const d = new Date(design.created_at * 1000);
      group = {
        date_key: key,
        date_label: d.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        design_count: 0,
        tryon_count: 0,
        designs: [],
        tryons: [],
      };
      buckets.set(key, group);
    }
    group.designs.push(design);
    group.design_count += 1;
  }
  for (const tryon of data.tryons) {
    const key = dateKeyFromTs(tryon.created_at);
    let group = buckets.get(key);
    if (!group) {
      const d = new Date(tryon.created_at * 1000);
      group = {
        date_key: key,
        date_label: d.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        design_count: 0,
        tryon_count: 0,
        designs: [],
        tryons: [],
      };
      buckets.set(key, group);
    }
    group.tryons.push(tryon);
    group.tryon_count += 1;
  }

  return [...buckets.values()].sort((a, b) => b.date_key.localeCompare(a.date_key));
}

export class GalleryApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** True when the studio API is likely still starting (e.g. after ./run_studio.sh). */
export function isTransientGalleryError(e: unknown): boolean {
  if (e instanceof GalleryApiError) {
    // Next dev proxy often returns 500 when uvicorn is not up yet.
    return e.status === 500 || e.status >= 502;
  }
  if (e instanceof TypeError) return true;
  if (e instanceof Error) {
    const m = e.message.toLowerCase();
    return (
      m.includes("failed to fetch") ||
      m.includes("load failed") ||
      m.includes("network") ||
      m.includes("econnrefused")
    );
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDeviceGalleryOnce(): Promise<GalleryResponse> {
  let res = await hmFetch(`${API_BASE}/api/design/gallery`, { cache: "no-store" });
  if (res.status === 404) {
    res = await hmFetch(`${API_BASE}/api/design/gallery/today`, { cache: "no-store" });
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new GalleryApiError(detail, res.status);
  }
  const raw = (await res.json()) as GalleryResponse;
  return {
    ...raw,
    range_label: raw.range_label ?? raw.date_label ?? "",
    tryon_count: raw.tryon_count ?? raw.tryons?.length ?? 0,
    groups: raw.groups?.length ? raw.groups : galleryGroupsFromResponse(raw),
  };
}

const GALLERY_MAX_ATTEMPTS = 15;

export async function fetchDeviceGallery(
  onRetry?: (attempt: number) => void,
): Promise<GalleryResponse> {
  let last: unknown;
  for (let attempt = 0; attempt < GALLERY_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) onRetry?.(attempt);
    try {
      return await fetchDeviceGalleryOnce();
    } catch (e) {
      last = e;
      if (!isTransientGalleryError(e) || attempt === GALLERY_MAX_ATTEMPTS - 1) {
        throw e;
      }
      await delay(Math.min(1200 + attempt * 500, 4000));
    }
  }
  throw last;
}

/** @deprecated Use fetchDeviceGallery */
export const fetchTodayGallery = fetchDeviceGallery;

export type TodayGalleryResponse = GalleryResponse;

export function galleryAssetUrl(path: string): string {
  if (path.startsWith("/api/tryon/")) return tryOnAssetUrl(path);
  return assetUrl(path);
}

export function imageCount(design: GalleryDesign): number {
  return design.sections.reduce(
    (n, s) => n + s.items.filter((i) => i.media_type.startsWith("image/")).length,
    0,
  );
}

export function sectionAssets(
  design: GalleryDesign,
  id: GallerySection["id"],
): GalleryAsset[] {
  return design.sections.find((s) => s.id === id)?.items ?? [];
}

export function sectionSpecRows(
  design: GalleryDesign,
): { key: string; value: string }[] {
  return design.sections.find((s) => s.id === "spec")?.spec_rows ?? [];
}
