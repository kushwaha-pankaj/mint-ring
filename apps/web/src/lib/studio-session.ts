/**
 * Ephemeral Design / Try-on workspace — not persisted across navigation.
 * Finished packs live in the gallery (server + /gallery).
 */

export const DESIGN_SESSION_KEY = "hm.design.session.v1";

export function clearDesignSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DESIGN_SESSION_KEY);
  } catch {
    /* quota or privacy mode */
  }
}

export function isStudioWorkspacePath(pathname: string): boolean {
  return pathname === "/design" || pathname === "/try-on";
}
