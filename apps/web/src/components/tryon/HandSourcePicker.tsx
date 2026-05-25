"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";

export function HandSourcePicker({
  onPick,
  disabled,
  locked,
}: {
  onPick: (file: File) => void;
  disabled?: boolean;
  /** True when no ring is loaded yet. */
  locked?: boolean;
}) {
  const [mode, setMode] = useState<"upload" | "camera">("upload");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inactive = Boolean(disabled || locked);

  return (
    <section
      className={`ds-step3-panel ts-hand-panel ${locked ? "ts-hand-panel--locked" : ""}`}
      aria-labelledby="ts-hand-source-title"
    >
      <h3 id="ts-hand-source-title" className="ds-step3-panel-title">
        2. Your hand photo
      </h3>
      <p className="ds-step3-panel-copy">
        Upload a still image or capture one with your camera. Keep the ring finger clear and
        roughly horizontal.
      </p>

      {locked && (
        <p className="ts-hand-locked-note" role="status">
          Complete step 1 first: generate a design pack in Design, then open Try on again.
        </p>
      )}

      <div className="tryon-source">
        <div className="tryon-source-tabs" role="tablist" aria-label="Hand photo source">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "upload"}
            className={`tryon-source-tab ${mode === "upload" ? "tryon-source-tab--on" : ""}`}
            onClick={() => setMode("upload")}
            disabled={inactive}
          >
            Upload
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "camera"}
            className={`tryon-source-tab ${mode === "camera" ? "tryon-source-tab--on" : ""}`}
            onClick={() => setMode("camera")}
            disabled={inactive}
          >
            Use camera
          </button>
        </div>

        {mode === "upload" ? (
          <div className="tryon-upload">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="tryon-upload-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPick(file);
                if (fileRef.current) fileRef.current.value = "";
              }}
              disabled={inactive}
            />
            <button
              type="button"
              className="ts-upload-dropzone"
              onClick={() => fileRef.current?.click()}
              disabled={inactive}
            >
              <Upload className="ts-upload-dropzone-icon" size={28} strokeWidth={1.35} aria-hidden />
              <span className="ts-upload-dropzone-title">Choose a hand photo</span>
              <span className="ts-upload-dropzone-hint">JPEG or PNG · up to 12 MB</span>
            </button>
          </div>
        ) : (
          <HandCamera onCapture={onPick} disabled={inactive} />
        )}
      </div>
    </section>
  );
}

function HandCamera({
  onCapture,
  disabled,
}: {
  onCapture: (file: File) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Camera access blocked. Check browser permissions and try again.",
      );
    }
  }, []);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", 0.92),
    );
    if (!blob) return;
    onCapture(new File([blob], "hand.jpg", { type: "image/jpeg" }));
  }, [onCapture]);

  useEffect(() => {
    function onVisibility() {
      if (document.hidden) stop();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [stop]);

  return (
    <div className="tryon-camera">
      <div className="tryon-camera-frame">
        <video ref={videoRef} className="tryon-camera-video" playsInline muted />
        {!active && (
          <div className="tryon-camera-placeholder">
            {error ??
              "Start the camera, hold your hand with the ring finger visible, then capture."}
          </div>
        )}
      </div>
      <div className="tryon-camera-actions">
        {active ? (
          <>
            <button type="button" className="btn-ghost" onClick={stop}>
              Stop camera
            </button>
            <button type="button" className="btn-primary" onClick={capture} disabled={disabled}>
              Capture hand
            </button>
          </>
        ) : (
          <button type="button" className="btn-primary" onClick={start} disabled={disabled}>
            Start camera
          </button>
        )}
      </div>
    </div>
  );
}
