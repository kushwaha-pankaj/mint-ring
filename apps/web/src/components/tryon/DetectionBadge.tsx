"use client";

import type { DetectionState } from "./LiveOverlay";

/**
 * Status pill that explains the current MediaPipe detection state in
 * customer-friendly language. Sits above the canvas.
 */
export function DetectionBadge({ state }: { state: DetectionState }) {
  const [tone, label, hint] = describe(state);
  // No warning banners in the placement step — Adjust covers edge cases.
  if (tone === "warn") return null;
  return (
    <div className={`tryon-badge tryon-badge--${tone}`} role="status">
      <span className="tryon-badge-dot" aria-hidden />
      <span className="tryon-badge-label">{label}</span>
      {hint && <span className="tryon-badge-hint">{hint}</span>}
    </div>
  );
}

function describe(s: DetectionState): ["ok" | "warn" | "err" | "idle", string, string | null] {
  switch (s.status) {
    case "idle":
      return ["idle", "Waiting for a hand photo", null];
    case "loading":
      return ["idle", "Detecting hand...", null];
    case "ok":
      return [
        "ok",
        s.palmFacing ? "Ring finger found (palm)" : "Ring finger found (back of hand)",
        "Switch to Adjust if you want to nudge the placement.",
      ];
    case "low-confidence":
      return [
        "warn",
        "Hand detected but the angle is awkward",
        "Try a flatter hand pose, or use Adjust to move the ring by hand.",
      ];
    case "no-hand":
      return [
        "warn",
        "We could not find a hand",
        "Try a clearer photo with the whole hand visible, or use Adjust.",
      ];
    case "error":
      return ["err", "Hand detector unavailable", s.message];
  }
}
