/**
 * Stable studio device id: persisted in localStorage + cookie, aligned with the
 * API's IP-derived machine id when the browser has no stored id yet.
 */
const STORAGE_KEY = "hm.device.v1";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )hm\.device\.v1=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(id: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${STORAGE_KEY}=${encodeURIComponent(id)}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; SameSite=Lax`;
}

function persistDeviceId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  writeCookie(id);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normaliseId(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase();
  return UUID_RE.test(cleaned) ? cleaned : null;
}

/** Read stored id (localStorage, then long-lived cookie). */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored =
      normaliseId(window.localStorage.getItem(STORAGE_KEY)) ??
      normaliseId(readCookie());
    if (stored) {
      persistDeviceId(stored);
      return stored;
    }
    const id = crypto.randomUUID();
    persistDeviceId(id);
    return id;
  } catch {
    return "";
  }
}

/**
 * Adopt the API machine id when nothing is stored yet (same IP → same UUID).
 * Call once on studio pages; safe to no-op when localStorage/cookie already set.
 */
export async function ensureStudioDeviceId(): Promise<string> {
  if (typeof window === "undefined") return "";
  const existing =
    normaliseId(window.localStorage.getItem(STORAGE_KEY)) ??
    normaliseId(readCookie());
  if (existing) {
    persistDeviceId(existing);
    return existing;
  }

  const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
  try {
    const res = await fetch(`${base}/api/studio/device`, { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as { machine_device_id?: string };
      const machine = normaliseId(body.machine_device_id);
      if (machine) {
        persistDeviceId(machine);
        return machine;
      }
    }
  } catch {
    /* fall through to random UUID */
  }

  return getDeviceId();
}

export function deviceHeaders(): Record<string, string> {
  const id = getDeviceId();
  return id ? { "X-HM-Device-Id": id } : {};
}
