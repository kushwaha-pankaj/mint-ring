"use client";

import { useId, useRef, useState } from "react";
import { IconBrowse, IconCamera, IconUpload } from "@/components/icons";
import { Button, SegmentButton, SegmentGroup } from "@/components/ui";
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
      <SegmentGroup
        className="upload-mode hm-segment-group--md"
        role="tablist"
        aria-label="Add a photograph"
        size="md"
      >
        <SegmentButton
          role="tab"
          aria-selected={mode === "upload"}
          active={mode === "upload"}
          size="md"
          icon={<IconUpload size={16} />}
          onClick={() => setMode("upload")}
        >
          Upload file
        </SegmentButton>
        <SegmentButton
          role="tab"
          aria-selected={mode === "camera"}
          active={mode === "camera"}
          size="md"
          icon={<IconCamera size={16} />}
          onClick={() => setMode("camera")}
        >
          Camera
        </SegmentButton>
      </SegmentGroup>

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
            <Button
              variant="outline"
              className="studio-cta upload-preview-replace"
              disabled={loading}
              onClick={openPicker}
              icon={<IconBrowse size={16} />}
              iconPosition="start"
            >
              Replace
            </Button>
          </div>
        </div>
      ) : (
        <div className="upload-empty">
          <IconUpload size={40} className="upload-empty-icon" />
          <p className="upload-empty-title">Add a ring photograph</p>
          <p className="upload-empty-meta">Drag and drop here, or choose a file</p>
          <Button
            variant="primary"
            className="upload-empty-browse"
            disabled={loading}
            onClick={openPicker}
            icon={<IconBrowse size={18} />}
            iconPosition="start"
          >
            Browse files
          </Button>
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
