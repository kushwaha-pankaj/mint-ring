"use client";

import { useEffect, useRef, useState } from "react";
import type { StageState } from "@/lib/design-api";

/**
 * A live percentage badge for one design-pack stage.
 *
 * Server reports completed/total at every poll. We linearly interpolate
 * between polls toward the next expected percentage so the bar always moves
 * even when no fresh data arrived since the last frame.
 *
 * Pending stages show 0 percent and a small "In queue" tag.
 * The stage that is next-up gets a brighter highlight via isNextUp.
 */
export function StageProgress({
  stage,
  label,
  isNextUp,
}: {
  stage: StageState | undefined;
  label: string;
  isNextUp: boolean;
}) {
  const status = stage?.status ?? "pending";
  const completed = stage?.progress_completed ?? 0;
  const total = Math.max(1, stage?.progress_total ?? 1);
  const realPct =
    status === "done"
      ? 100
      : status === "failed"
        ? 100
        : status === "skipped"
          ? 0
          : status === "running"
            ? Math.min(95, Math.round((completed / total) * 100))
            : 0;

  // Soft interpolation: nudge the displayed percent toward the real target
  // a few times per second while the stage is running. Snap to 100 on done.
  const [displayPct, setDisplayPct] = useState<number>(realPct);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(stage?.started_at ?? null);

  useEffect(() => {
    if (status === "done" || status === "failed") {
      setDisplayPct(100);
      return;
    }
    if (status === "pending" || status === "skipped") {
      setDisplayPct(0);
      return;
    }
    if (stage?.started_at && startedAtRef.current !== stage.started_at) {
      startedAtRef.current = stage.started_at;
    }
    const startedAt = startedAtRef.current ?? Date.now() / 1000;
    const estimate = Math.max(2, stage?.duration_estimate_s ?? 6);

    const step = () => {
      const now = Date.now() / 1000;
      const elapsed = Math.max(0, now - startedAt);
      // Soft elapsed-based ceiling so the bar keeps moving even between
      // server pings, but never exceeds the real reported percentage by
      // more than 10 points.
      const elapsedPct = Math.min(95, Math.round((elapsed / estimate) * 90));
      const target = Math.max(realPct, Math.min(realPct + 10, elapsedPct));
      setDisplayPct((p) => (p === target ? p : p + Math.sign(target - p)));
      rafRef.current = window.setTimeout(step, 500) as unknown as number;
    };
    rafRef.current = window.setTimeout(step, 500) as unknown as number;
    return () => {
      if (rafRef.current) clearTimeout(rafRef.current);
    };
  }, [status, realPct, stage?.started_at, stage?.duration_estimate_s]);

  const tag =
    status === "done"
      ? "Complete"
      : status === "failed"
        ? "Failed"
        : status === "skipped"
          ? "Skipped"
          : status === "running"
            ? stage?.progress_label ?? `Generating ${displayPct} percent`
            : isNextUp
              ? "Next up"
              : "In queue";

  return (
    <div
      className={[
        "ds-stage-progress",
        `ds-stage-progress--${status}`,
        isNextUp && status === "pending" ? "ds-stage-progress--next" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-status={status}
    >
      <div className="ds-stage-progress-head">
        <span className="ds-stage-progress-label">{label}</span>
        <span className="ds-stage-progress-percent" aria-live="polite">
          {status === "done" ? "100" : status === "skipped" ? "0" : displayPct}
          <small>%</small>
        </span>
      </div>
      <div className="ds-stage-progress-bar" aria-hidden>
        <span
          className="ds-stage-progress-fill"
          style={{
            width: `${status === "done" ? 100 : status === "skipped" ? 0 : displayPct}%`,
          }}
        />
      </div>
      <p className="ds-stage-progress-tag">{tag}</p>
    </div>
  );
}
