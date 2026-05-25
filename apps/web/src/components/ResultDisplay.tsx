"use client";

import type { AnalyseResult, DetectionMeta, IdentifyResult } from "@/lib/api";
import {
  ringFromSku,
  siblingsByMetal,
  metalSwatch,
  metalLabel,
  type RingMeta,
} from "@/lib/catalogue";
import { RingThumb } from "./RingThumb";
import { DetectionPanel } from "./DetectionPanel";
import { Analysis } from "./Analysis";
import { MatchControls } from "./MatchControls";
import { MatchDetails } from "./MatchDetails";
import { MatchShortlist } from "./MatchShortlist";
import {
  CATALOGUE_MATCH_LEAD,
  CATALOGUE_MATCH_STATUS,
  CATALOGUE_NO_MATCH_LEAD,
  CATALOGUE_NO_MATCH_STATUS,
} from "@/lib/catalogue-match";

export function ResultDisplay({
  result,
  preview,
  cropUrl,
  detection,
  analysis,
  analysisLoading,
  analysisError,
  onAnalyse,
  canAnalyse,
  loading,
  error,
  onClear,
  onPickCandidate,
  threshold,
  topK,
  onThresholdChange,
  onTopKChange,
  technicalInDetails = false,
}: {
  result: IdentifyResult | null;
  preview: string | null;
  cropUrl?: string | null;
  detection?: DetectionMeta | null;
  analysis?: AnalyseResult | null;
  analysisLoading?: boolean;
  analysisError?: string | null;
  onAnalyse?: () => void;
  canAnalyse?: boolean;
  loading: boolean;
  error: string | null;
  onClear?: () => void;
  onPickCandidate?: (idx: number) => void;
  threshold: number;
  topK: number;
  onThresholdChange: (next: number) => void;
  onTopKChange: (next: number) => void;
  /** Collapse threshold, shortlist, and metrics behind one disclosure (Identify page). */
  technicalInDetails?: boolean;
}) {
  const userImage = detection?.applied && cropUrl ? cropUrl : preview;
  const detected = Boolean(detection?.applied);
  const showDetectionPanel = Boolean(
    preview &&
      detection &&
      (detection.applied ||
        detection.detectionUnavailable ||
        detection.detectionReason ||
        (detection.candidates?.length ?? 0) > 0),
  );
  const showAnalysis = Boolean(analysis || analysisLoading || analysisError);
  const showAnalyseCta = Boolean(
    canAnalyse && !analysis && !analysisLoading && !analysisError && !loading && result !== null && onAnalyse,
  );

  if (loading) {
    if (!showDetectionPanel || !detection || !preview) return null;

    return (
      <section className="match-flow" aria-live="polite" aria-busy="true">
        <DetectionPanel
          imageSrc={preview}
          cropUrl={cropUrl}
          detection={detection}
          onPickCandidate={onPickCandidate}
        />
      </section>
    );
  }

  if (error) {
    return (
      <section className="match-flow" aria-live="polite">
        {showDetectionPanel && detection && preview && (
          <DetectionPanel
            imageSrc={preview}
            cropUrl={cropUrl}
            detection={detection}
            onPickCandidate={onPickCandidate}
          />
        )}
        <OutcomePanel
          title="Identification failed"
          lead="The service did not respond. Try again in a moment."
          detail={error}
          onClear={onClear}
          primaryLabel="Try again"
          primaryAction={onClear}
        />
      </section>
    );
  }

  if (!result) return null;

  if (!result.is_confident || result.top_k.length === 0 || result.class_scores.length === 0) {
    return (
      <section className="match-flow" aria-live="polite">
        {showDetectionPanel && detection && preview && (
          <DetectionPanel
            imageSrc={preview}
            cropUrl={cropUrl}
            detection={detection}
            onPickCandidate={onPickCandidate}
          />
        )}

        <CatalogueNoMatch
          result={result}
          userImage={userImage}
          detected={detected}
          onClear={onClear}
        />

        <MatchResearchBlock
          result={result}
          detection={detection}
          threshold={threshold}
          topK={topK}
          loading={loading}
          technicalInDetails={technicalInDetails}
          onThresholdChange={onThresholdChange}
          onTopKChange={onTopKChange}
        />
      </section>
    );
  }

  const matchedSku = result.predicted_class;
  const matched = ringFromSku(matchedSku);
  const matchedRefPath =
    result.top_k.find((m) => m.label === matchedSku)?.source_path ??
    result.top_k[0]?.source_path;
  const siblings = siblingsByMetal(
    matchedSku,
    result.top_k.filter((m) => m.label !== matchedSku),
  );
  const confidencePct = Math.round(result.confidence * 100);

  return (
    <section className="match-flow" aria-live="polite">
      {showDetectionPanel && detection && preview && (
        <DetectionPanel
          imageSrc={preview}
          cropUrl={cropUrl}
          detection={detection}
          onPickCandidate={onPickCandidate}
        />
      )}

      <div className="match-flow__outcome">
        <div className="match-flow__compare">
          <figure className="match-flow__figure">
            <div className="match-flow__figure-media">
              <RingThumb refPath={matchedRefPath} alt={matched.name} size="md" fill />
            </div>
            <figcaption>Closest catalogue reference</figcaption>
          </figure>
          {userImage && (
            <figure className="match-flow__figure">
              <div className="match-flow__figure-media">
                <RingThumb src={userImage} alt="Your photograph" size="md" fill />
              </div>
              <figcaption>{detected ? "Selected crop" : "Your photograph"}</figcaption>
            </figure>
          )}
        </div>

        <div className="match-flow__summary font-display">
          <div className="match-flow__summary-head">
            <p className="studio-label">Catalogue result</p>
            <p className="match-flow__status match-flow__status--ok">{CATALOGUE_MATCH_STATUS}</p>
          </div>
          <p className="match-flow__sku">{matched.sku}</p>
          <h2 className="match-flow__name">{matched.name}</h2>
          <p className="match-flow__meta">
            <MetalDot metal={matched.metal} />
            <span className="match-flow__meta-text">{matched.subtitle}</span>
            <span className="match-flow__conf match-flow__conf--ok">
              {confidencePct}% similarity
            </span>
          </p>
          <p className="match-flow__lead">{CATALOGUE_MATCH_LEAD}</p>
          {siblings.length > 0 && (
            <p className="match-flow__variants">
              <span className="match-flow__variants-label">Also available in</span>
              {siblings.map((s, i) => (
                <span key={s.sku} className="match-flow__variant">
                  {i > 0 && <span aria-hidden>, </span>}
                  <MetalDot metal={s.metal} />
                  {metalLabel(s.metal)}
                </span>
              ))}
            </p>
          )}
          <div className="match-flow__actions">
            <a
              href="https://www.hockleymint.co.uk/wedding-rings.aspx"
              target="_blank"
              rel="noreferrer noopener"
              className="btn-primary studio-cta"
            >
              View in catalogue
            </a>
            {onClear && (
              <button type="button" onClick={onClear} className="btn-outline studio-cta">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <MatchResearchBlock
        result={result}
        detection={detection}
        threshold={threshold}
        topK={topK}
        loading={loading}
        technicalInDetails={technicalInDetails}
        onThresholdChange={onThresholdChange}
        onTopKChange={onTopKChange}
      />

      <ResultsFollowOn
        showAnalyseCta={showAnalyseCta}
        analysisImageSrc={userImage ?? undefined}
        analysisImageCaption={detected ? "Selected crop" : "Your photograph"}
        onAnalyse={onAnalyse}
        analysisLoading={analysisLoading}
        analysis={analysis}
        analysisError={analysisError}
        showAnalysis={showAnalysis}
        result={result}
        detection={detection}
      />
    </section>
  );
}

function MatchResearchBlock({
  result,
  detection,
  threshold,
  topK,
  loading,
  technicalInDetails,
  onThresholdChange,
  onTopKChange,
}: {
  result: IdentifyResult;
  detection?: DetectionMeta | null;
  threshold: number;
  topK: number;
  loading: boolean;
  technicalInDetails: boolean;
  onThresholdChange: (next: number) => void;
  onTopKChange: (next: number) => void;
}) {
  const inner = (
    <>
      <MatchControls
        embedded
        className="match-controls--in-results"
        threshold={threshold}
        topK={topK}
        onThresholdChange={onThresholdChange}
        onTopKChange={onTopKChange}
        disabled={loading}
      />
      <div className="match-rank-panel__divide" aria-hidden />
      <MatchShortlist embedded result={result} />
      <MatchDetails
        result={result}
        detection={detection ?? undefined}
        variant="standalone"
        showHead={!technicalInDetails}
      />
    </>
  );

  if (technicalInDetails) {
    return (
      <details className="id-match-technical font-display" aria-label="Technical detail">
        <summary>Technical detail</summary>
        <div className="match-rank-panel match-rank-panel--in-details">{inner}</div>
      </details>
    );
  }

  return (
    <div className="match-rank-panel font-display" aria-label="Match settings and catalogue shortlist">
      {inner}
    </div>
  );
}

function ResultsFollowOn({
  showAnalyseCta,
  analysisImageSrc,
  analysisImageCaption = "Your photograph",
  onAnalyse,
  analysisLoading,
  analysis,
  analysisError,
  showAnalysis,
  result,
  detection,
}: {
  showAnalyseCta: boolean;
  analysisImageSrc?: string;
  analysisImageCaption?: string;
  onAnalyse?: () => void;
  analysisLoading?: boolean;
  analysis?: AnalyseResult | null;
  analysisError?: string | null;
  showAnalysis: boolean;
  result: IdentifyResult;
  detection?: DetectionMeta | null;
}) {
  return (
    <div className="match-flow__follow-on">
      {showAnalyseCta && onAnalyse && (
        <section className="match-flow__analyse-cta" aria-label="Design analysis">
          <figure className="match-flow__analyse-visual">
            <div className="match-flow__analyse-frame">
              {analysisImageSrc ? (
                <RingThumb
                  src={analysisImageSrc}
                  alt={analysisImageCaption}
                  fill
                />
              ) : (
                <span className="match-flow__analyse-placeholder" aria-hidden />
              )}
            </div>
            <figcaption>{analysisImageCaption}</figcaption>
          </figure>

          <div className="match-flow__analyse-body">
            <div className="match-flow__analyse-copy">
              <p className="studio-label">Design analysis</p>
              <h3 className="match-flow__analyse-title studio-section-title">
                Read the design
              </h3>
              <p className="match-flow__analyse-lead">
                Metal, setting, centre stone, and band profile — read directly from
                the photograph.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary studio-cta match-flow__analyse-btn"
              onClick={onAnalyse}
            >
              Analyse this ring
            </button>
          </div>
        </section>
      )}

      {showAnalysis && (
        <Analysis
          result={analysis ?? null}
          loading={Boolean(analysisLoading)}
          error={analysisError}
          onRetry={onAnalyse}
          imageSrc={analysisImageSrc}
          imageCaption={analysisImageCaption}
        />
      )}
    </div>
  );
}

function CatalogueNoMatch({
  result,
  userImage,
  detected,
  onClear,
}: {
  result: IdentifyResult;
  userImage?: string | null;
  detected: boolean;
  onClear?: () => void;
}) {
  const thresholdPct = Math.round(result.threshold * 100);
  const bestPct = Math.round(result.confidence * 100);

  return (
    <div className="match-flow__outcome match-flow__outcome--empty">
      <div className="match-flow__compare">
        {userImage ? (
          <figure className="match-flow__figure">
            <div className="match-flow__figure-media">
              <RingThumb src={userImage} alt="Your photograph" size="md" fill />
            </div>
            <figcaption>{detected ? "Selected crop" : "Your photograph"}</figcaption>
          </figure>
        ) : (
          <figure className="match-flow__figure">
            <div className="match-flow__figure-media match-flow__figure-media--empty" aria-hidden>
              <span className="match-flow__empty-icon" />
            </div>
            <figcaption>Your photograph</figcaption>
          </figure>
        )}
      </div>

      <div className="match-flow__summary match-flow__summary--empty">
        <div className="match-flow__summary-head">
          <p className="studio-label">Catalogue result</p>
          <p className="match-flow__status match-flow__status--empty">{CATALOGUE_NO_MATCH_STATUS}</p>
        </div>

        <p className="match-flow__sku">Confidence setting · {thresholdPct}%</p>
        <h2 className="match-flow__name font-display">We couldn&apos;t find this ring in the catalogue</h2>

        <div className="match-flow__empty-stat" role="status">
          <span className="match-flow__empty-stat-label">Highest similarity in this search</span>
          <span className="match-flow__empty-stat-value">{bestPct}%</span>
        </div>

        <p className="match-flow__empty-lead">{CATALOGUE_NO_MATCH_LEAD}</p>

        {onClear && (
          <div className="match-flow__actions">
            <button type="button" onClick={onClear} className="btn-outline studio-cta">
              Clear and try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OutcomePanel({
  title,
  lead,
  detail,
  imageSrc,
  imageAlt,
  onClear,
  primaryLabel,
  primaryHref,
  primaryAction,
  secondaryLabel,
  secondaryAction,
}: {
  title: string;
  lead: string;
  detail?: string;
  imageSrc?: string | null;
  imageAlt?: string;
  onClear?: () => void;
  primaryLabel: string;
  primaryHref?: string;
  primaryAction?: () => void;
  secondaryLabel?: string;
  secondaryAction?: () => void;
}) {
  return (
    <div className="match-flow__outcome-panel">
      {imageSrc && (
        <figure className="match-flow__outcome-visual">
          <RingThumb src={imageSrc} alt={imageAlt} size="md" fill />
        </figure>
      )}
      <div className="match-flow__outcome-copy">
        <h2 className="match-flow__outcome-title">{title}</h2>
        <p className="match-flow__outcome-lead">{lead}</p>
        {detail && (
          <details className="match-flow__outcome-detail">
            <summary>Technical detail</summary>
            <pre>{detail}</pre>
          </details>
        )}
        <div className="match-flow__outcome-actions">
          {primaryHref ? (
            <a href={primaryHref} className="btn-primary studio-cta">
              {primaryLabel}
            </a>
          ) : (
            <button type="button" className="btn-primary studio-cta" onClick={primaryAction}>
              {primaryLabel}
            </button>
          )}
          {secondaryLabel && secondaryAction && (
            <button type="button" className="btn-outline studio-cta" onClick={secondaryAction}>
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MetalDot({ metal }: { metal: RingMeta["metal"] }) {
  return (
    <span
      className="match-metal"
      style={{ background: metalSwatch(metal) }}
      title={metalLabel(metal)}
      aria-hidden
    />
  );
}
