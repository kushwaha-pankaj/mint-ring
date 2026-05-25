"use client";

import { useEffect, useRef, useState } from "react";
import { IconCamera } from "@/components/icons";
import { Button } from "@/components/ui";

/**
 * Live camera capture. Requests permission, streams to a <video>, and on
 * "Capture" snaps one frame into a File the caller can hand to identify().
 */
export function Webcam({
  onCapture,
  disabled,
}: {
  onCapture: (file: File) => void;
  disabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
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
          : "We could not access your camera. Check permissions and try again.",
      );
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Selfie webcams stream a non-mirrored feed but users see (and reason about)
    // a mirrored preview. Flip horizontally before encoding so the saved JPEG
    // matches what they expect — MediaPipe's handedness reads correctly on the
    // mirrored frame.
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, "image/jpeg", 0.92),
    );
    if (!blob) return;
    onCapture(new File([blob], "webcam.jpg", { type: "image/jpeg" }));
  }

  useEffect(() => {
    function onVisibility() {
      if (document.hidden) stop();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);

  return (
    <div className="upload-camera">
      <div className="upload-camera-frame">
        <video
          ref={videoRef}
          className="upload-camera-video"
          playsInline
          muted
        />
        {!active && (
          <div className="upload-camera-placeholder">
            {error ?? "Start the camera, then hold the ring steady in frame."}
          </div>
        )}
      </div>

      <div className="upload-camera-actions">
        {active ? (
          <>
            <Button
              variant="outline"
              className="studio-cta"
              onClick={stop}
              icon={<IconCamera size={16} />}
              iconPosition="start"
            >
              Stop camera
            </Button>
            <Button
              variant="primary"
              className="studio-cta"
              onClick={capture}
              disabled={disabled}
              icon={<IconCamera size={16} />}
              iconPosition="start"
            >
              Take photo & identify
            </Button>
          </>
        ) : (
          <Button
            variant="primary"
            className="studio-cta w-full sm:w-auto"
            onClick={start}
            icon={<IconCamera size={16} />}
            iconPosition="start"
          >
            Start camera
          </Button>
        )}
      </div>
    </div>
  );
}
