"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DesignPageHero } from "@/components/design/DesignPageHero";
import { DesignBuilderColumn } from "@/components/design/DesignBuilderColumn";
import { DesignConceptSidebar } from "@/components/design/DesignConceptSidebar";
import { DesignSelectionSummarySidebar } from "@/components/design/DesignSelectionSummarySidebar";
import { DesignPackResults } from "@/components/design/DesignPackResults";
import { DesignResultsBackButton } from "@/components/design/DesignResultsBackButton";
import { DesignReviewSidebar } from "@/components/design/DesignReviewSidebar";
import { DesignWhatsNextSidebar } from "@/components/design/DesignWhatsNextSidebar";
import {
  EMPTY_BRIEF,
  validateBrief,
  type DesignBrief,
} from "@/lib/design-brief";
import {
  cancelGeneration,
  DesignApiError,
  resetDesignSession,
  startGeneration,
} from "@/lib/design-api";
import { useDesignJob } from "@/lib/design-job";
import { clearDesignSession } from "@/lib/studio-session";

const CATALOGUE_URL = "https://www.hockleymint.co.uk";

export default function DesignPage() {
  const [wizardStep, setWizardStep] = useState(1);
  const [brief, setBrief] = useState<DesignBrief>({ ...EMPTY_BRIEF });
  const [jobId, setJobId] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const builderRef = useRef<HTMLDivElement>(null);

  // Fresh wizard each visit; gallery handoff uses ?job_id= only (server-backed).
  useEffect(() => {
    clearDesignSession();
    const params = new URLSearchParams(window.location.search);
    const urlJobId = params.get("job_id");
    if (urlJobId) {
      setJobId(urlJobId);
      setShowResults(true);
      setWizardStep(4);
      return;
    }
    setWizardStep(1);
    setBrief({ ...EMPTY_BRIEF });
    setJobId(null);
    setShowResults(false);
    setSubmitError(null);
  }, []);

  useEffect(() => () => clearDesignSession(), []);

  const { job, error: jobError, isPolling } = useDesignJob(
    showResults ? jobId : null,
  );

  const generating =
    submitting ||
    (showResults && (job?.status === "queued" || job?.status === "running" || isPolling));

  const updateBrief = useCallback((patch: Partial<DesignBrief>) => {
    setBrief((prev) => ({ ...prev, ...patch }));
  }, []);

  const onGenerate = useCallback(async () => {
    const validation = validateBrief(brief);
    if (!validation.ok || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const response = await startGeneration(brief);
      setJobId(response.job_id);
      setShowResults(true);
    } catch (err) {
      setSubmitError(
        err instanceof DesignApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not start generation. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [brief, submitting]);

  const onRegenerate = useCallback(() => {
    if (!validateBrief(brief).ok || submitting) return;
    // Cancel any still-running job before starting a fresh one.
    if (jobId && job && (job.status === "queued" || job.status === "running")) {
      void cancelGeneration(jobId);
    }
    setJobId(null);
    void onGenerate();
  }, [brief, job, jobId, onGenerate, submitting]);

  const onStopGeneration = useCallback(async () => {
    if (!jobId || cancelling) return;
    if (job && job.status !== "queued" && job.status !== "running") return;
    setCancelling(true);
    try {
      await cancelGeneration(jobId);
    } catch {
      /* polling will surface connection issues */
    } finally {
      setCancelling(false);
    }
  }, [cancelling, job, jobId]);

  const onStartOver = useCallback(async () => {
    if (jobId && job && (job.status === "queued" || job.status === "running")) {
      try {
        await cancelGeneration(jobId);
      } catch {
        /* session reset cancels everything anyway */
      }
    }
    try {
      await resetDesignSession();
    } catch {
      /* still reset the UI even if the API is unreachable */
    }
    clearDesignSession();
    setBrief({ ...EMPTY_BRIEF });
    setJobId(null);
    setSubmitError(null);
    setShowResults(false);
    setWizardStep(1);
  }, [job, jobId]);

  const onImprove = useCallback(() => {
    setShowResults(false);
    setWizardStep(2);
    builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onBackToSteps = useCallback(() => {
    if (jobId && job && (job.status === "queued" || job.status === "running")) {
      void cancelGeneration(jobId);
    }
    setShowResults(false);
    setWizardStep(4);
    builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [job, jobId]);

  const onNext = useCallback(() => {
    setWizardStep((s) => Math.min(4, s + 1));
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }, []);

  const onBack = useCallback(() => {
    setWizardStep((s) => Math.max(1, s - 1));
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  }, []);

  const onEditPrompt = useCallback(() => {
    setShowResults(false);
    setWizardStep(3);
  }, []);

  const showTipBar = wizardStep <= 3 && !showResults;

  return (
    <div
      className={[
        "studio-page saas-page ds-page",
        wizardStep === 1 && !showResults ? "ds-page--step1" : "",
        wizardStep === 2 && !showResults ? "ds-page--step2" : "",
        wizardStep === 3 && !showResults ? "ds-page--step3" : "",
        wizardStep === 4 && !showResults ? "ds-page--step4" : "",
        showResults ? "ds-page--results" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!showResults && <DesignPageHero currentStep={wizardStep} />}

      <section id="design-studio" className="studio ds-studio" aria-label="Design a ring">
        {showResults && <DesignResultsBackButton onClick={onBackToSteps} />}

        <div
          className={`studio-sheet studio-sheet--overlap ds-sheet ${
            generating ? "studio-sheet--loading" : ""
          }`}
        >
          {showResults ? (
            <DesignPackResults
              brief={brief}
              job={job}
              jobError={jobError}
              generating={Boolean(generating)}
              stopping={cancelling}
              onRegenerate={onRegenerate}
              onImprove={onImprove}
              onStartOver={onStartOver}
              onStopGeneration={() => void onStopGeneration()}
            />
          ) : (
            <div
              className={[
                "ds-page-grid",
                wizardStep === 1 ? "ds-page-grid--step1" : "",
                wizardStep === 2 ? "ds-page-grid--step2" : "",
                wizardStep === 3 ? "ds-page-grid--step3" : "",
                wizardStep === 4 ? "ds-page-grid--step4" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div ref={builderRef} className="ds-page-col ds-page-col--builder">
                <DesignBuilderColumn
                  step={wizardStep}
                  brief={brief}
                  onChange={updateBrief}
                  onNext={onNext}
                  onBack={onBack}
                  onGenerate={onGenerate}
                  onEditPrompt={onEditPrompt}
                  generating={Boolean(generating)}
                />
                {submitError && wizardStep === 4 && (
                  <div className="ds-submit-error" role="alert">
                    {submitError}
                  </div>
                )}
              </div>

              <div className="ds-page-col ds-page-col--sidebar">
                {wizardStep === 1 ? (
                  <DesignWhatsNextSidebar step={wizardStep} />
                ) : wizardStep === 2 ? (
                  <DesignSelectionSummarySidebar brief={brief} />
                ) : wizardStep === 3 ? (
                  <DesignConceptSidebar brief={brief} />
                ) : (
                  <DesignReviewSidebar />
                )}
              </div>
            </div>
          )}
        </div>

        {showTipBar && wizardStep === 1 && (
          <div className="ds-tip-bar ds-tip-bar--step1" role="note">
            <span className="ds-tip-bar-badge" aria-hidden>
              i
            </span>
            <p>
              <strong>Tip</strong> You can change your choices at any time in the next steps.
            </p>
          </div>
        )}
        {showTipBar && wizardStep !== 1 && (
          <div className="ds-tip-bar ds-tip-bar--gallery" role="note">
            <p>
              <strong>Need inspiration?</strong> Explore our gallery of ring styles and trends.
            </p>
            <a
              href={CATALOGUE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="btn-ghost ds-tip-cta"
            >
              Explore gallery
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
