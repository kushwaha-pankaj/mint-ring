"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  DESIGN_PROMPT_PLACEHOLDER,
  MAX_INSPIRATION_UPLOADS,
  MOOD_OPTIONS,
  OUTPUT_PACK_OPTIONS,
  PROMPT_MAX_CHARS,
  type DesignBrief,
  type OutputPackId,
} from "@/lib/design-brief";
import { moodIcon, outputPackIcon } from "@/lib/design-option-icons";
import { Check, Info, Loader2, Upload } from "lucide-react";
import {
  assetUrl,
  deleteInspiration,
  uploadInspiration,
  DesignApiError,
} from "@/lib/design-api";

const OUTPUT_META: Record<OutputPackId, { sublabel: string }> = {
  sketch: { sublabel: "Concept Sketch" },
  hero: { sublabel: "Realistic Render" },
  mesh: { sublabel: "Research 3D Mesh" },
  angles: { sublabel: "Different Angle Views" },
  lighting: { sublabel: "Lighting Variations" },
  spec: { sublabel: "AI Specifications" },
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;

export function DesignStep3Form({
  brief,
  onChange,
  disabled,
}: {
  brief: DesignBrief;
  onChange: (patch: Partial<DesignBrief>) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const toggleMood = (value: string) => {
    const set = new Set(brief.moods);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    onChange({ moods: [...set], mood: [...set][0] ?? "" });
  };

  const togglePack = (id: OutputPackId) => {
    const set = new Set(brief.outputPack);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ outputPack: [...set] as OutputPackId[] });
  };

  const onFilePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    if (brief.inspirationUploads.length >= MAX_INSPIRATION_UPLOADS) {
      setUploadError(`Maximum ${MAX_INSPIRATION_UPLOADS} inspiration images.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setUploadError("Choose a JPG or PNG image.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("File is larger than 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const upload = await uploadInspiration(file);
      onChange({
        inspirationUploads: [...brief.inspirationUploads, upload].slice(
          0,
          MAX_INSPIRATION_UPLOADS,
        ),
      });
    } catch (err) {
      const message =
        err instanceof DesignApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Upload failed.";
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  const removeUpload = async (uploadId: string) => {
    onChange({
      inspirationUploads: brief.inspirationUploads.filter((u) => u.upload_id !== uploadId),
    });
    try {
      await deleteInspiration(uploadId);
    } catch {
      // Server-side delete is best-effort — frontend state already updated.
    }
  };

  const charCount = brief.notes.length;
  const visibleUploads = brief.inspirationUploads.slice(0, MAX_INSPIRATION_UPLOADS);
  const uploadAtMax = brief.inspirationUploads.length >= MAX_INSPIRATION_UPLOADS;

  return (
    <div className="ds-step3">
      <div className="ds-step3-grid">
        <div className="ds-step3-stack">
          <section className="ds-step3-panel" aria-labelledby="ds-style-mood">
            <h3 id="ds-style-mood" className="ds-step3-panel-title">
              1. Style mood
            </h3>
            <p className="ds-step3-panel-copy">Choose the overall vibe of your ring.</p>
            <div className="ds-step3-chip-grid" role="group" aria-label="Style mood">
              {MOOD_OPTIONS.map((opt) => {
                const active = brief.moods.includes(opt.value);
                const MoodIcon = moodIcon(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ds-step3-chip ${active ? "ds-step3-chip--active" : ""}`}
                    aria-pressed={active}
                    onClick={() => toggleMood(opt.value)}
                    disabled={disabled}
                  >
                    {active && (
                      <span className="ds-step3-chip-check" aria-hidden>
                        <Check size={12} strokeWidth={2.5} aria-hidden />
                      </span>
                    )}
                    <MoodIcon className="ds-step3-chip-icon" />
                    <span className="ds-step3-chip-label">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="ds-step3-panel" aria-labelledby="ds-inspiration-images">
            <h3 id="ds-inspiration-images" className="ds-step3-panel-title">
              2. Inspiration images <span>(Optional)</span>
            </h3>
            <p className="ds-step3-panel-copy">
              Upload images that inspire the look and feel you love. We&apos;ll read attributes
              from each one and feed them into your prompt.
            </p>
            <div className="ds-inspiration-grid">
              {visibleUploads.map((upload) => (
                <figure key={upload.upload_id} className="ds-inspiration-thumb-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetUrl(upload.url)}
                    alt={upload.filename}
                    className="ds-inspiration-thumb"
                  />
                  <button
                    type="button"
                    className="ds-inspiration-remove"
                    aria-label={`Remove ${upload.filename}`}
                    onClick={() => removeUpload(upload.upload_id)}
                    disabled={disabled || uploading}
                  >
                    ×
                  </button>
                  {upload.attributes.length > 0 && (
                    <figcaption className="ds-inspiration-attrs">
                      {upload.attributes
                        .slice(0, 3)
                        .map((a) => a.top)
                        .filter(Boolean)
                        .join(" · ")}
                    </figcaption>
                  )}
                </figure>
              ))}
              {!uploadAtMax && (
                <button
                  type="button"
                  className="ds-inspiration-upload-tile"
                  onClick={() => fileRef.current?.click()}
                  disabled={disabled || uploading}
                  aria-busy={uploading}
                >
                  {uploading ? (
                    <Loader2 size={28} className="ds-upload-icon ds-upload-icon--spin" aria-hidden />
                  ) : (
                    <Upload size={28} className="ds-upload-icon" aria-hidden />
                  )}
                  <span>{uploading ? "Uploading..." : "Upload more"}</span>
                </button>
              )}
            </div>
            <p className="ds-inspiration-tip">
              {brief.inspirationUploads.length}/{MAX_INSPIRATION_UPLOADS} used · JPG or PNG, up to 8 MB each
            </p>
            {uploadError && (
              <p className="ds-inspiration-error" role="alert">
                {uploadError}
              </p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="ds-sr-only"
              onChange={onFilePick}
              disabled={disabled || uploading}
            />
          </section>
        </div>

        <div className="ds-step3-stack">
          <section className="ds-step3-panel" aria-labelledby="design-prompt-label">
            <h3 id="design-prompt-label" className="ds-step3-panel-title">
              3. Describe your ring
            </h3>
            <p className="ds-step3-panel-copy">Write your idea in your own words.</p>
            <div className="ds-prompt-input-wrap">
              <textarea
                id="design-prompt"
                className="ds-textarea ds-textarea--prompt"
                rows={5}
                maxLength={PROMPT_MAX_CHARS}
                placeholder={DESIGN_PROMPT_PLACEHOLDER}
                value={brief.notes}
                onChange={(e) => onChange({ notes: e.target.value })}
                disabled={disabled}
              />
              <p className="ds-char-count" aria-live="polite">
                {charCount}/{PROMPT_MAX_CHARS}
              </p>
            </div>
          </section>

          <fieldset className="ds-step3-panel ds-step3-panel--pack" disabled={disabled}>
            <legend className="ds-step3-panel-title">4. Choose your output pack</legend>
            <p className="ds-step3-panel-copy">Select what you want our AI to generate for you.</p>
            <div className="ds-output-pack-grid">
              {OUTPUT_PACK_OPTIONS.map((opt) => {
                const active = brief.outputPack.includes(opt.id);
                const meta = OUTPUT_META[opt.id];
                const PackIcon = outputPackIcon(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`ds-output-pack-card ${active ? "ds-output-pack-card--active" : ""}`}
                    aria-pressed={active}
                    onClick={() => togglePack(opt.id)}
                  >
                    {active && (
                      <span className="ds-output-pack-check" aria-hidden>
                        <Check size={12} strokeWidth={2.5} aria-hidden />
                      </span>
                    )}
                    <PackIcon className="ds-output-pack-icon" />
                    <span className="ds-output-pack-title">{meta.sublabel}</span>
                    <span className="ds-output-pack-hint">
                      {opt.id === "angles"
                        ? "(4 views)"
                        : opt.id === "lighting"
                          ? "(4 styles)"
                          : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="ds-step3-info">
              <Info size={16} className="ds-step3-info-icon" aria-hidden />
              You can customise or add more outputs in the next step.
            </p>
          </fieldset>
        </div>
      </div>
    </div>
  );
}

