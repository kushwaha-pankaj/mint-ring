"use client";

import { useEffect, useRef, useState } from "react";
import { DesignApiError, getJob, type JobSnapshot } from "./design-api";

type State = {
  job: JobSnapshot | null;
  error: DesignApiError | Error | null;
  isPolling: boolean;
};

const FAST_INTERVAL_MS = 1500;
const SLOW_INTERVAL_MS = 3000;
const SLOW_AFTER_MS = 90_000;

/**
 * Polls /api/design/generate/{jobId} until the job reaches a terminal state.
 * Backs off to 3 s after 90 s of polling so a stuck Pollinations call doesn't
 * hammer the API. Cancels itself on unmount or when jobId becomes null.
 */
export function useDesignJob(jobId: string | null): State {
  const [job, setJob] = useState<JobSnapshot | null>(null);
  const [error, setError] = useState<DesignApiError | Error | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    if (!jobId) {
      setJob(null);
      setError(null);
      setIsPolling(false);
      return () => {
        cancelledRef.current = true;
      };
    }

    setIsPolling(true);
    setError(null);
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const snap = await getJob(jobId);
        if (cancelledRef.current) return;
        setJob(snap);
        if (
          snap.status === "succeeded" ||
          snap.status === "failed" ||
          snap.status === "cancelled"
        ) {
          setIsPolling(false);
          return;
        }
        const elapsed = Date.now() - startedAt;
        const next = elapsed > SLOW_AFTER_MS ? SLOW_INTERVAL_MS : FAST_INTERVAL_MS;
        timerRef.current = setTimeout(tick, next);
      } catch (e) {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        // Don't give up immediately — keep polling slowly through transient errors.
        timerRef.current = setTimeout(tick, SLOW_INTERVAL_MS);
      }
    };

    void tick();

    return () => {
      cancelledRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [jobId]);

  return { job, error, isPolling };
}
