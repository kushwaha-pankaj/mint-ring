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
import { IdentifyHero } from "@/components/identify/IdentifyHero";
import { IdentifySidebar } from "@/components/identify/IdentifySidebar";
import { UploadPanel } from "@/components/UploadPanel";
import { SamplePicks } from "@/components/SamplePicks";
import { ResultDisplay } from "@/components/ResultDisplay";
import {
  MATCH_THRESHOLD_DEFAULT,
  MATCH_TOPK_DEFAULT,
} from "@/components/MatchControls";

function identifyStep(hasPhoto: boolean, showResult: boolean, loading: boolean): number {
  if (showResult && !loading) return 3;
  if (hasPhoto || loading) return 2;
  return 1;
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
  const sourceFileRef = useRef<File | null>(null);
  const analyseFileRef = useRef<File | null>(null);
  const identifyFileRef = useRef<File | null>(null);
  const identifyReqRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const cropUrlRef = useRef<string | null>(null);

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
      const candNow = (detection?.candidates ?? [])[idx];
      if (!candNow) return;

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
            setDetection((prev) => (prev ? { ...prev, finger: resolved } : prev));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold, topK]);

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
  const step = identifyStep(hasPhoto, showResult, loading);

  return (
    <div className="studio-page saas-page ds-page ds-page--identify">
      <IdentifyHero currentStep={step} />

      <section id="studio" className="studio ds-studio" aria-label="Identify a ring">
        <div
          className={`studio-sheet studio-sheet--overlap ds-sheet ${loading ? "studio-sheet--loading" : ""}`}
        >
          {loading && (
            <div
              className="studio-progress"
              role="progressbar"
              aria-label="Matching in progress"
            />
          )}

          <div className="id-studio-grid">
            <div className="ds-wizard-card ds-wizard-card--identify">
              <h2 className="id-panel-title">Your photograph</h2>
              <p className="id-panel-copy">
                Try a curated sample or upload your own. We match against the full Hockley
                Mint reference gallery.
              </p>

              <div className="id-samples-strip">
                <p className="thread">Quick samples</p>
                <SamplePicks
                  onPick={onPick}
                  disabled={loading}
                  activePickId={activeSampleId}
                  loading={loading}
                />
              </div>

              <UploadPanel
                preview={preview}
                loading={loading}
                onPick={onPick}
                hasResult={showResult && !loading}
              />
            </div>

            <div className="id-studio-sidebar">
              <IdentifySidebar step={step} />
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
                technicalInDetails
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
