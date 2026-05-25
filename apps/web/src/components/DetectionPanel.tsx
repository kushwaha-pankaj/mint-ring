"use client";

import type { DetectionMeta } from "@/lib/api";
import { DetectionOverlay } from "./DetectionOverlay";

/**
 * Detection review: photograph with overlay, selected crop card, and readable facts.
 */
export function DetectionPanel({
  imageSrc,
  cropUrl,
  detection,
  onPickCandidate,
}: {
  imageSrc: string;
  cropUrl?: string | null;
  detection: DetectionMeta;
  onPickCandidate?: (idx: number) => void;
}) {
  const finger = detection.finger ?? "n/a";
  const hand = detection.handedness ?? "n/a";
  const handScore = detection.handednessScore;
  const detScore = detection.detectionScore;
  const detectorLabel = detection.detectorLabel ?? "GroundingDINO";
  const detectionsN = detection.candidates?.length ?? (detection.bbox ? 1 : 0);
  const hasBox = detectionsN > 0 || Boolean(detection.bbox);
  const hasCrop = Boolean(cropUrl);
  const lowConfidence =
    detection.noRingFound === true ||
    (typeof detScore === "number" && detScore < 0.12);

  const bboxLabel = detection.bbox
    ? detection.bbox.map((n) => Math.round(n)).join(", ")
    : "n/a";

  return (
    <section className="detection-hero" aria-label="Ring detection review">
      <header className="detection-hero__head">
        <p className="studio-label">Ring detection</p>
        <h2 className="detection-hero__title studio-section-title">
          {hasBox ? (
            <>
              Ring <span className="detection-hero__accent">located</span>
              {detection.finger && (
                <>
                  {" "}
                  on the <span className="detection-hero__accent">{finger}</span>
                </>
              )}
            </>
          ) : (
            <>
              Looking for the <span className="detection-hero__accent">ring</span>
            </>
          )}
          {lowConfidence && <span className="detection-hero__warn">Low confidence</span>}
        </h2>
        <p className="detection-hero__lead">
          {detection.detectionUnavailable
            ? detection.detectionReason
            : detection.detectionReason ??
              "We isolate the ring before matching, so a busy background or a second hand doesn't confuse the catalogue."}
        </p>
        <ul className="detection-hero__meta" aria-label="Detector summary">
          <li>
            <span className="detection-hero__meta-k">Rings found</span>
            <span className="detection-hero__meta-v">{detectionsN}</span>
          </li>
          <li>
            <span className="detection-hero__meta-k">Latency</span>
            <span className="detection-hero__meta-v">{detection.latencyMs} ms</span>
          </li>
          <li>
            <span className="detection-hero__meta-k">Model</span>
            <span className="detection-hero__meta-v">{detectorLabel}</span>
          </li>
        </ul>
      </header>

      <div className="detection-hero__stage">
        <div className="detection-hero__visual">
          <div className="detection-hero__canvas">
            <DetectionOverlay
              imageSrc={imageSrc}
              detection={detection}
              onPickCandidate={onPickCandidate}
            />
            {(detection.candidates?.length ?? 0) > 1 && (
              <p className="detection-hero__hint">
                Tap a different ring if we picked the wrong one.
              </p>
            )}
          </div>
        </div>

        <aside className="detection-hero__aside" aria-label="Crop and detection facts">
          <div className="detection-hero__crop-card">
            <div className="detection-hero__crop-head">
              <p className="detection-hero__aside-label">Selected crop</p>
              <p className="detection-hero__crop-caption">
                {hasCrop
                  ? "This is what we send to the catalogue"
                  : "We'll use the full photograph instead"}
              </p>
            </div>
            <div className="detection-hero__crop-frame">
              {cropUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cropUrl} alt="Selected ring crop sent for matching" />
              ) : (
                <p className="detection-hero__crop-empty">
                  {detection.detectionUnavailable
                    ? "Detector could not run on this image."
                    : hasBox
                      ? "Using the full photograph for matching."
                      : "No ring region was detected."}
                </p>
              )}
            </div>
          </div>

          <dl className="detection-hero__facts">
            <Fact term="Finger" value={finger} />
            <Fact term="Hand" value={hand} />
            <Fact
              term="Confidence"
              value={typeof detScore === "number" ? `${(detScore * 100).toFixed(0)}%` : "n/a"}
              warn={lowConfidence}
            />
            <Fact
              term="Hand score"
              value={typeof handScore === "number" ? `${(handScore * 100).toFixed(0)}%` : "n/a"}
            />
            <Fact term="Bounding box" value={bboxLabel} mono />
          </dl>
        </aside>
      </div>
    </section>
  );
}

function Fact({
  term,
  value,
  mono,
  warn,
}: {
  term: string;
  value: string;
  mono?: boolean;
  warn?: boolean;
}) {
  return (
    <div className={`detection-hero__fact ${warn ? "detection-hero__fact--warn" : ""}`}>
      <dt className="detection-hero__fact-label">{term}</dt>
      <dd className={`detection-hero__fact-value ${mono ? "detection-hero__fact-value--mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
