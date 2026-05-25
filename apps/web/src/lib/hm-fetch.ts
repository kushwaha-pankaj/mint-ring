import { deviceHeaders } from "./device-id";

/** fetch with the studio device header attached for scoped server storage. */
export function hmFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const extra = deviceHeaders();
  const base =
    init?.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : Array.isArray(init?.headers)
        ? Object.fromEntries(init.headers)
        : (init?.headers as Record<string, string> | undefined) ?? {};

  return fetch(input, {
    ...init,
    headers: { ...extra, ...base },
  });
}
