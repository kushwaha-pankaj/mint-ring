/**
 * Tiny indicator that the photo went through the auto-detect crop step.
 * Used under the "Your photograph" tile in the result. Mint dot + plain copy;
 * no scores, no thresholds — that detail lives in <MatchDetails>.
 */
export function DetectionBadge({ finger }: { finger?: string }) {
  const label = finger ? `Detected on ${finger} finger` : "Detected on hand";
  return (
    <span className="detection-badge">
      <span className="detection-badge-dot" aria-hidden />
      {label}
    </span>
  );
}
