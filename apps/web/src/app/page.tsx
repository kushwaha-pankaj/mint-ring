"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyseRing,
  identifyRing,
  type AnalyseResult,
  type DetectionMeta,
  type IdentifyResult,
} from "@/lib/api";
import { detectRingRegion, recropForCandidate } from "@/lib/detector";
import { resolveFingerForBox } from "@/lib/finger-resolve";
import { Hero } from "@/components/Hero";
import { UploadPanel } from "@/components/UploadPanel";
import { SamplePicks } from "@/components/SamplePicks";
import { ResultDisplay } from "@/components/ResultDisplay";
import {
  MatchControls,
  MATCH_THRESHOLD_DEFAULT,
  MATCH_TOPK_DEFAULT,
} from "@/components/MatchControls";

function StudioSteps({
  hasPhoto,
  hasResult,
  loading,
}: {
  hasPhoto: boolean;
  hasResult: boolean;
  loading: boolean;
}) {
  const step2 = hasPhoto || loading;
  const step3 = hasResult || loading;

  return (
    <nav className="studio-steps" aria-label="Identify steps">
      <span className="studio-step studio-step--on">
        <span className="studio-step-num">01</span>
        <span className="studio-step-text">Sample</span>
      </span>
      <span className="studio-step-line" aria-hidden />
      <span className={step2 ? "studio-step studio-step--on" : "studio-step"}>
        <span className="studio-step-num">02</span>
        <span className="studio-step-text">Photo</span>
      </span>
      <span className="studio-step-line" aria-hidden />
      <span className={step3 ? "studio-step studio-step--on" : "studio-step"}>
        <span className="studio-step-num">03</span>
        <span className="studio-step-text">Match</span>
      </span>
    </nav>
  );
}

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalyseResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(MATCH_THRESHOLD_DEFAULT);
  const [topK, setTopK] = useState(MATCH_TOPK_DEFAULT);
  const resultRef = useRef<HTMLDivElement>(null);
  /** Keep the original uploaded File around so click-to-correct can re-crop
   *  against the same source without re-decoding the user's pick. */
  const sourceFileRef = useRef<File | null>(null);
  /** File sent to /api/analyse — always the detected ring crop when available, else the upload. */
  const analyseFileRef = useRef<File | null>(null);
  /** File last fed into /api/identify (crop if a hand was found, else original). */
  const identifyFileRef = useRef<File | null>(null);
  /** Latest in-flight request token so threshold scrubbing doesn't race. */
  const identifyReqRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const cropUrlRef = useRef<string | null>(null);

  /**
   * Run the full pipeline: client-side ring detection → /api/identify on the
   * crop (or the original if no hand was found) → render. ObjectURLs are
   * cleaned up here, so callers don't need to.
   */
  const onPick = useCallback(async (file: File, fromSampleId?: string) => {
    setActiveSampleId(fromSampleId ?? null);
    setError(null);
    setResult(null);
    setAnalysis(null);
    setAnalysisLoading(false);
    setAnalysisError(null);
    setDetection(null);
    sourceFileRef.current = file;
    analyseFileRef.current = null;

    // Preview = original photograph, always. Crop URL only when applied.
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      return url;
    });
    setCropUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      cropUrlRef.current = null;
      return null;
    });

    setLoading(true);
    try {
      const det = await detectRingRegion(file);
      setDetection({
        applied: det.applied,
        detectionSource: det.detectionSource,
        detectorLabel: det.detectorLabel,
        detectionUnavailable: det.detectionUnavailable,
        detectionReason: det.detectionReason,
        candidates: det.candidates,
        chosenIdx: det.chosenIdx,
        finger: det.finger,
        fingerIndex: det.fingerIndex,
        handedness: det.handedness,
        handednessScore: det.handednessScore,
        detectionScore: det.detectionScore,
        noRingFound: det.noRingFound,
        bbox: det.bbox,
        landmarks: det.landmarks,
        imageWidth: det.imageWidth,
        imageHeight: det.imageHeight,
        latencyMs: det.latencyMs,
        method: det.method,
      });
      if (det.applied && det.cropUrl) {
        cropUrlRef.current = det.cropUrl;
        setCropUrl(det.cropUrl);
      }

      const toIdentify = det.applied && det.crop ? det.crop : file;
      analyseFileRef.current = toIdentify;
      identifyFileRef.current = toIdentify;
      const reqId = ++identifyReqRef.current;
      const next = await identifyRing(toIdentify, { threshold, topK });
      if (identifyReqRef.current === reqId) setResult(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [threshold, topK]);

  /**
   * Click-to-correct. The user clicks a runner-up bbox in the overlay; we
   * re-crop against that bbox, re-run identify, and update
   * detection.chosenIdx so the overlay re-renders with the new winner.
   */
  const onPickCandidate = useCallback(
    async (idx: number) => {
      const file = sourceFileRef.current;
      if (!file) return;
      setDetection((prev) => {
        if (!prev || !prev.candidates) return prev;
        const cand = prev.candidates[idx];
        if (!cand) return prev;
        return {
          ...prev,
          chosenIdx: idx,
          bbox: cand.bbox,
          finger: cand.finger,
          fingerIndex: cand.fingerIndex,
          detectionScore: cand.confidence,
        };
      });
      // Get the candidate from the current state (read AFTER setState above
      // queued; useRef'ed src is fine since the candidates don't change).
      const candNow = (detection?.candidates ?? [])[idx];
      if (!candNow) return;

      // Re-resolve finger in case the user clicked a detector candidate whose
      // finger we hadn't resolved (rare but possible).
      const resolved =
        candNow.finger ??
        (detection?.landmarks
          ? resolveFingerForBox(candNow.bbox, detection.landmarks)?.finger
          : undefined);

      setLoading(true);
      setError(null);
      setAnalysis(null);
      setAnalysisError(null);
      try {
        const cropped = await recropForCandidate(file, candNow.bbox);
        if (cropped) {
          setCropUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            cropUrlRef.current = cropped.url;
            return cropped.url;
          });
          analyseFileRef.current = cropped.file;
          identifyFileRef.current = cropped.file;
          const reqId = ++identifyReqRef.current;
          const next = await identifyRing(cropped.file, { threshold, topK });
          if (identifyReqRef.current === reqId) setResult(next);
          if (resolved) {
            setDetection((prev) => prev ? { ...prev, finger: resolved } : prev);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [detection, threshold, topK],
  );

  const onReset = useCallback(() => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      previewUrlRef.current = null;
      return null;
    });
    setCropUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      cropUrlRef.current = null;
      return null;
    });
    setResult(null);
    setAnalysis(null);
    setAnalysisLoading(false);
    setAnalysisError(null);
    setDetection(null);
    analyseFileRef.current = null;
    identifyFileRef.current = null;
    setActiveSampleId(null);
    setError(null);
  }, []);

  // Live threshold / shortlist scrubbing. Whenever the operator drags the
  // slider or steps top-k, re-run /api/identify on the last image so the
  // confidence badge, ranked shortlist, and per-class scores update in place.
  // We debounce + stamp requests so a fast drag never races stale responses
  // into the UI. Skipped on first mount (no image yet) and during the initial
  // identification (loading=true; that pass already used the latest values).
  useEffect(() => {
    const file = identifyFileRef.current;
    if (!file || loading) return;
    const reqId = ++identifyReqRef.current;
    const handle = setTimeout(() => {
      identifyRing(file, { threshold, topK })
        .then((next) => {
          if (identifyReqRef.current === reqId) setResult(next);
        })
        .catch((e) => {
          if (identifyReqRef.current === reqId) {
            setError(e instanceof Error ? e.message : String(e));
          }
        });
    }, 120);
    return () => clearTimeout(handle);
    // `loading` intentionally NOT in the dep list — we only want this to fire
    // on threshold/topK changes; the initial identify pass already used the
    // current values, and including `loading` would double-fire on completion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, topK]);

  // Revoke blob URLs on unmount so repeated identify sessions don't leak.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (cropUrlRef.current) URL.revokeObjectURL(cropUrlRef.current);
    };
  }, []);

  const onAnalyse = useCallback(async () => {
    const file = analyseFileRef.current;
    if (!file) {
      setAnalysisError("No detected ring photograph is available to analyse.");
      return;
    }
    if (analysisLoading) return;
    setAnalysis(null);
    setAnalysisError(null);
    setAnalysisLoading(true);
    try {
      setAnalysis(await analyseRing(file));
    } catch (e) {
      setAnalysis(null);
      setAnalysisError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalysisLoading(false);
    }
  }, [analysisLoading]);

  const showResult = loading || result !== null || error !== null;
  const hasPhoto = preview !== null;

  return (
    <div className="studio-page saas-page">
      <Hero />

      <section id="studio" className="studio" aria-label="Identify a ring">
        <div className={`studio-sheet studio-sheet--overlap ${loading ? "studio-sheet--loading" : ""}`}>
          {loading && (
            <div className="studio-progress" role="progressbar" aria-label="Matching in progress" />
          )}

          <header className="studio-board-head">
            <div>
              <p className="studio-label">Identification studio</p>
              <h2 className="studio-board-title">Live catalogue matching</h2>
            </div>
            <div className="studio-board-meta" aria-label="Workflow summary">
              <span>Sample</span>
              <span>Upload</span>
              <span>Match</span>
            </div>
          </header>

          <StudioSteps hasPhoto={hasPhoto} hasResult={showResult && !loading} loading={loading} />

          <div className="studio-grid">
            <div className="studio-col studio-col--samples">
              <SamplePicks
                onPick={onPick}
                disabled={loading}
                activePickId={activeSampleId}
                loading={loading}
              />
            </div>

            <div className="studio-col studio-col--upload">
              <header className="studio-intro">
                <p className="studio-label">Your photograph</p>
                <h2 className="studio-heading">Upload or capture</h2>
                <p className="studio-hint">
                  Face-on, steady light works best. We&apos;ll match against the full Hockley Mint catalogue.
                </p>
              </header>

              <UploadPanel
                preview={preview}
                loading={loading}
                onPick={onPick}
                hasResult={showResult && !loading}
              />

              <MatchControls
                threshold={threshold}
                topK={topK}
                onThresholdChange={setThreshold}
                onTopKChange={setTopK}
                disabled={loading}
              />
            </div>
          </div>

          {showResult && (
            <div ref={resultRef} className="studio-reveal-anchor">
              <ResultDisplay
                result={result}
                preview={preview}
                cropUrl={cropUrl}
                detection={detection}
                analysis={analysis}
                analysisLoading={analysisLoading}
                analysisError={analysisError}
                onAnalyse={onAnalyse}
                canAnalyse={!loading && result !== null}
                loading={loading}
                error={error}
                onClear={onReset}
                onPickCandidate={onPickCandidate}
                threshold={threshold}
                topK={topK}
                onThresholdChange={setThreshold}
                onTopKChange={setTopK}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
