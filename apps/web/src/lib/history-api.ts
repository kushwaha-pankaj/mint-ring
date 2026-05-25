import { hmFetch } from "./hm-fetch";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export type HistoryKind = "design" | "tryon";
export type HistoryStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type HistoryEntry = {
  entry_id: string;
  kind: HistoryKind;
  ref_id: string;
  title: string;
  preview_url: string | null;
  status: HistoryStatus;
  href: string;
  created_at: number;
  updated_at: number;
};

export type HistoryListResponse = {
  device_id: string;
  entries: HistoryEntry[];
};

export class HistoryApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function listHistory(): Promise<HistoryListResponse> {
  const res = await hmFetch(`${API_BASE}/api/history/`, { cache: "no-store" });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* ignore */
    }
    throw new HistoryApiError(detail, res.status);
  }
  return (await res.json()) as HistoryListResponse;
}

export async function deleteHistoryEntry(entryId: string): Promise<void> {
  const res = await hmFetch(`${API_BASE}/api/history/${entryId}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    throw new HistoryApiError(res.statusText, res.status);
  }
}

export function historyAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE}${path}`;
}
