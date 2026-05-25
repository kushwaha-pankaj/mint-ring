"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TryOnHero } from "@/components/tryon/TryOnHero";
import { HandSourcePicker } from "@/components/tryon/HandSourcePicker";
import { TryOnRingPanel } from "@/components/tryon/TryOnRingPanel";
import { DetectionBadge } from "@/components/tryon/DetectionBadge";
import { LiveOverlay, type LiveOverlayHandle, type DetectionState } from "@/components/tryon/LiveOverlay";
import { LiveAR } from "@/components/tryon/LiveAR";
import { HeroResultPanel } from "@/components/tryon/HeroResultPanel";
import { TryOnLightbox } from "@/components/tryon/TryOnLightbox";
import { IconLiveAR, IconPhotoreal, IconRefresh } from "@/components/icons";
import { Button, SegmentButton, SegmentGroup, SegmentTab, SegmentTabList } from "@/components/ui";
import {
  generateTryOn,
  TryOnApiError,
  type GenerateResponse,
} from "@/lib/tryon-api";
import {
  resolveRingSource,
  type RingSource,
} from "@/lib/tryon-ring-source";
import { clearDesignSession } from "@/lib/studio-session";

function resetTryOnWorkspace() {
  return {
    tab: "photo" as const,
    handFile: null,
    handImage: null,
    mode: "auto" as const,
    detection: { status: "idle" } as DetectionState,
    generating: false,
    generateError: null,
    refined: null,
    beforeUrl: null,
  };
}

export default function TryOnPage() {
  const router = useRouter();
  const [ring, setRing] = useState<RingSource | null>(null);
  const [ringLoading, setRingLoading] = useState(true);
  // Track whether we've initiated a redirect, so we render a minimal
  // splash instead of the full UI while the navigation is in flight.
  const [gateRedirecting, setGateRedirecting] = useState(false);

  // Top-level mode: photoreal (FLUX Kontext, paid, ~15s) vs live AR
  // (free, in-browser, real-time). Live AR requires a GLB from the
  // design pack; if the mesh stage didn't finish, the tab is disabled.
  const [tab, setTab] = useState<"photo" | "ar">("photo");

  const [handFile, setHandFile] = useState<File | null>(null);
  const [handImage, setHandImage] = useState<HTMLImageElement | null>(null);

  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [detection, setDetection] = useState<DetectionState>({ status: "idle" });

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [refined, setRefined] = useState<GenerateResponse | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [snapshotPreview, setSnapshotPreview] = useState<{
    url: string;
    label: string;
  } | null>(null);

  const overlayRef = useRef<LiveOverlayHandle | null>(null);

  const handLocked = ringLoading || !ring;

  useEffect(() => {
    clearDesignSession();
    const params = new URLSearchParams(window.location.search);
    const hasHandoff = Boolean(params.get("job_id") || params.get("design"));
    const hasSavedRender = Boolean(params.get("render_id"));

    if (!hasHandoff && !hasSavedRender) {
      const fresh = resetTryOnWorkspace();
      setTab(fresh.tab);
      setHandFile(fresh.handFile);
      setHandImage(fresh.handImage);
      setMode(fresh.mode);
      setDetection(fresh.detection);
      setGenerating(fresh.generating);
      setGenerateError(fresh.generateError);
      setRefined(fresh.refined);
      setBeforeUrl(fresh.beforeUrl);
      setSnapshotPreview(null);
    }
  }, []);

  useEffect(() => () => clearDesignSession(), []);

  // Open a saved try-on from /history?render_id=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const renderId = params.get("render_id");
    if (!renderId) return;
    const path = `/api/tryon/renders/${renderId}.jpg`;
    setRefined({
      render_id: renderId,
      url: path,
      engine: "saved",
      seed: 0,
      latency_ms: 0,
      image_size: { width: 0, height: 0 },
    });
    setTab("photo");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRingLoading(true);
    resolveRingSource().then((r) => {
      if (cancelled) return;
      setRing(r);
      setRingLoading(false);
      // Gate: Try-on is meaningless without a finished design pack. If
      // none can be resolved (no session, no ?job_id=, or the job hasn't
      // produced a hero yet), bounce the user to /design.
      if (!r) {
        setGateRedirecting(true);
        router.replace("/design?from=tryon");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!handFile) {
      setHandImage(null);
      return;
    }
    const url = URL.createObjectURL(handFile);
    const img = new Image();
    img.onload = () => setHandImage(img);
    img.onerror = () => setHandImage(null);
    img.src = url;
    return () => {
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(url);
    };
  }, [handFile]);

  useEffect(() => {
    setRefined(null);
    if (beforeUrl) {
      URL.revokeObjectURL(beforeUrl);
      setBeforeUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handFile]);

  const onGenerate = useCallback(async () => {
    if (!overlayRef.current || !ring) return;
    setGenerateError(null);
    setGenerating(true);
    try {
      // The "before" tile is just the user's hand photo. FLUX does the
      // actual placement server-side — we don't pre-composite anything.
      const handBlob = await overlayRef.current.toHandImageBlob({ quality: 0.92 });
      if (!handBlob) {
        setGenerateError("Could not read the hand photo. Try a different image.");
        return;
      }
      if (beforeUrl) URL.revokeObjectURL(beforeUrl);
      setBeforeUrl(URL.createObjectURL(handBlob));

      const response = await generateTryOn(handBlob, ring.ringImageUrl, {
        handFilename: "hand.jpg",
      });
      setRefined(response);
    } catch (e) {
      const message =
        e instanceof TryOnApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not generate the try-on. Please try again.";
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  }, [beforeUrl, ring]);

  const canGenerate =
    !!handImage &&
    !!ring &&
    !generating &&
    detection.status !== "loading";

  const onResetAdjust = useCallback(() => overlayRef.current?.resetAdjust(), []);
  const onRedetect = useCallback(() => overlayRef.current?.redetect(), []);

  const closeSnapshotPreview = useCallback(() => {
    setSnapshotPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  useEffect(() => {
    const url = snapshotPreview?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [snapshotPreview]);

  // Gate screen: shown while the design-session resolve is in flight, and
  // while the redirect to /design is being kicked off when no design
  // exists. Renders nothing of the workspace, so the gated UI never
  // flashes on screens that aren't entitled to see it.
  if (ringLoading || gateRedirecting || !ring) {
    return (
      <div className="studio-page saas-page ds-page ds-page--tryon ts-gate">
        <div className="ts-gate-card hm-reveal" role="status" aria-live="polite">
          <p className="thread">Try on</p>
          <h1 className="ds-sidebar-title ts-gate-title">
            {gateRedirecting
              ? "Design a ring first"
              : "Checking your design pack..."}
          </h1>
          <p className="ts-gate-body">
            {gateRedirecting
              ? "Try-on works on a ring you have generated. Taking you to Design..."
              : "Looking for the hero render from your latest design."}
          </p>
          {gateRedirecting && (
            <a href="/design?from=tryon" className="ds-forest-cta ts-gate-cta">
              Open Design
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="studio-page saas-page ds-page ds-page--tryon">
      <TryOnHero />

      <section id="tryon-studio" className="studio ds-studio" aria-label="Try a ring on">
        <div className="studio-sheet studio-sheet--overlap ds-sheet">
          <div className="ts-studio-layout">
            <div className="ts-studio-ring">
              <TryOnRingPanel ring={ring} loading={ringLoading} />
            </div>

            <div className="ts-studio-flow">
              <div className="ds-wizard-card ds-wizard-card--tryon">
                <SegmentTabList
                  className="ts-tabs"
                  role="tablist"
                  aria-label="Try-on mode"
                >
                  <SegmentTab
                    role="tab"
                    aria-selected={tab === "photo"}
                    active={tab === "photo"}
                    className="ts-tab"
                    icon={<IconPhotoreal size={20} />}
                    label="Photoreal try-on"
                    meta="FLUX Kontext, ~15 s"
                    onClick={() => setTab("photo")}
                    disabled={generating}
                  />
                  <SegmentTab
                    role="tab"
                    aria-selected={tab === "ar"}
                    active={tab === "ar"}
                    className="ts-tab"
                    icon={<IconLiveAR size={20} />}
                    label="Live AR"
                    meta={ring.meshUrl ? "Webcam, real-time, free" : "Mesh not in this pack"}
                    onClick={() => setTab("ar")}
                    disabled={generating || !ring.meshUrl}
                    title={
                      ring.meshUrl
                        ? undefined
                        : "Live AR needs a 3D mesh. Generate the Design pack with the mesh stage on."
                    }
                  />
                </SegmentTabList>

                {tab === "ar" && ring.meshUrl ? (
                  <section className="ts-workspace-stage" aria-labelledby="ts-ar-title">
                    <h3 id="ts-ar-title" className="ds-step3-panel-title">
                      Live AR preview
                    </h3>
                    <p className="ds-step3-panel-copy">
                      Real-time webcam preview. The 3D ring from your design pack follows your
                      finger. No server calls per frame, no cost. Take a snapshot to preview a
                      still without leaving live AR.
                    </p>
                    <LiveAR
                      meshUrl={ring.meshUrl}
                      onSnapshot={(blob) => {
                        const url = URL.createObjectURL(blob);
                        setSnapshotPreview((prev) => {
                          if (prev) URL.revokeObjectURL(prev.url);
                          return { url, label: "Live AR snapshot" };
                        });
                      }}
                    />
                  </section>
                ) : null}

                {tab === "photo" && (
                  <HandSourcePicker
                    onPick={(f) => setHandFile(f)}
                    disabled={generating}
                    locked={handLocked}
                  />
                )}

                {tab === "photo" && handImage && (
                  <section
                    className="ts-workspace-stage"
                    aria-labelledby="ts-placement-title"
                  >
                    <h3 id="ts-placement-title" className="ds-step3-panel-title">
                      3. Confirm placement, then generate
                    </h3>
                    <p className="ds-step3-panel-copy">
                      The green target shows where the ring will be placed. Use Adjust to drag it
                      if your ring finger was not detected correctly, then generate the photoreal
                      try-on.
                    </p>

                    <div className="ts-canvas-toolbar">
                      <DetectionBadge state={detection} />
                      <div className="ts-canvas-actions">
                        <SegmentGroup
                          className="ts-mode-switch"
                          role="tablist"
                          aria-label="Placement mode"
                          size="sm"
                        >
                          <SegmentButton
                            role="tab"
                            aria-selected={mode === "auto"}
                            active={mode === "auto"}
                            size="sm"
                            className="ts-mode-btn"
                            onClick={() => {
                              setMode("auto");
                              onResetAdjust();
                            }}
                            disabled={generating}
                          >
                            Auto
                          </SegmentButton>
                          <SegmentButton
                            role="tab"
                            aria-selected={mode === "manual"}
                            active={mode === "manual"}
                            size="sm"
                            className="ts-mode-btn"
                            onClick={() => setMode("manual")}
                            disabled={generating}
                          >
                            Adjust
                          </SegmentButton>
                        </SegmentGroup>
                        <Button
                          variant="ghost"
                          className="ts-toolbar-btn"
                          onClick={onRedetect}
                          disabled={generating}
                          title="Run hand detection again"
                          icon={<IconRefresh size={16} />}
                          iconPosition="start"
                        >
                          Re-detect
                        </Button>
                      </div>
                    </div>

                    <LiveOverlay
                      ref={overlayRef}
                      handImage={handImage}
                      mode={mode}
                      uiFrozen={generating}
                      onDetectionChange={setDetection}
                    />

                    <p className="ts-engine-note">
                      The green target is just a preview of where the ring will go. Final placement,
                      sizing, perspective, and shadow are rendered by FLUX Kontext from the original
                      design.
                    </p>

                    <div className="ts-generate-row">
                      <button
                        type="button"
                        className="ds-forest-cta ts-generate-btn"
                        onClick={onGenerate}
                        disabled={!canGenerate}
                      >
                        {generating ? "Refining…" : "Generate photoreal try-on"}
                      </button>
                      {generateError && (
                        <p className="ts-generate-error" role="alert">
                          {generateError}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {tab === "photo" && (
                  <HeroResultPanel before={beforeUrl} refined={refined} />
                )}
              </div>
            </div>
          </div>
        </div>

      </section>

      {snapshotPreview && (
        <TryOnLightbox
          url={snapshotPreview.url}
          label={snapshotPreview.label}
          onClose={closeSnapshotPreview}
        />
      )}
    </div>
  );
}
