"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Webcam } from "./Webcam";

type Mode = "upload" | "camera";

export function UploadPanel({
  preview,
  loading,
  onPick,
  hasResult = false,
}: {
  preview: string | null;
  loading: boolean;
  onPick: (file: File) => void;
  hasResult?: boolean;
}) {
  const [mode, setMode] = useState<Mode>("upload");
  const inputId = useId();

  return (
    <div className={`upload-panel ${hasResult ? "upload-panel--matched" : ""}`}>
      <div className="upload-mode" role="tablist" aria-label="Add a photograph">
        <ModeButton active={mode === "upload"} onClick={() => setMode("upload")}>
          Upload file
        </ModeButton>
        <ModeButton active={mode === "camera"} onClick={() => setMode("camera")}>
          Camera
        </ModeButton>
      </div>

      {mode === "upload" ? (
        <FileUpload
          id={inputId}
          preview={preview}
          loading={loading}
          onPick={onPick}
        />
      ) : (
        <Webcam onCapture={onPick} disabled={loading} />
      )}

      {loading && (
        <p className="upload-panel-status" role="status">
          Matching against catalogue…
        </p>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={active ? "upload-mode-btn upload-mode-btn--on" : "upload-mode-btn"}
    >
      {children}
    </button>
  );
}

function FileUpload({
  id,
  preview,
  loading,
  onPick,
}: {
  id: string;
  preview: string | null;
  loading: boolean;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  function pickFile(file: File | undefined) {
    if (file && file.type.startsWith("image/")) onPick(file);
  }

  function openPicker() {
    if (!loading) inputRef.current?.click();
  }

  const zoneClass = [
    "upload-zone",
    drag ? "upload-zone--drag" : "",
    loading ? "upload-zone--busy" : "",
    preview ? "upload-zone--has-preview" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={zoneClass}
      onDragOver={(e) => {
        e.preventDefault();
        if (!loading) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        pickFile(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="sr-only"
        disabled={loading}
        onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {preview ? (
        <div className="upload-preview">
          <div className="upload-preview-stage">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your ring photograph" className="upload-preview-image" />
          </div>
          <div className="upload-preview-bar">
            <div className="upload-preview-copy">
              <span className="upload-preview-label">Your photograph</span>
              <span className="upload-preview-hint">Drop a new file here or replace</span>
            </div>
            <button
              type="button"
              className="btn-outline studio-cta upload-preview-replace"
              disabled={loading}
              onClick={openPicker}
            >
              Replace
            </button>
          </div>
        </div>
      ) : (
        <div className="upload-empty">
          <UploadIcon />
          <p className="upload-empty-title">Add a ring photograph</p>
          <p className="upload-empty-meta">Drag and drop here, or choose a file</p>
          <button
            type="button"
            className="btn-primary upload-empty-browse"
            disabled={loading}
            onClick={openPicker}
          >
            Browse files
          </button>
          <p className="upload-empty-formats">JPG, PNG or WebP. Face-on, steady light.</p>
        </div>
      )}

      {loading && (
        <div className="upload-zone-overlay" aria-hidden>
          <span className="upload-zone-spinner" />
        </div>
      )}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      className="upload-empty-icon"
      aria-hidden
    >
      <path d="M20 26V14M20 14l-5 5M20 14l5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 28h24" strokeLinecap="round" />
      <rect x="6" y="8" width="28" height="24" rx="1" />
    </svg>
  );
}
