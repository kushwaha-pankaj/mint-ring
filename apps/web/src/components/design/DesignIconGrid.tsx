"use client";

import type { ComponentType } from "react";

export type IconGridOption = {
  value: string;
  label: string;
  swatch?: string;
  icon?: ComponentType<{ className?: string }>;
};

export function DesignIconGrid({
  label,
  options,
  value,
  values,
  onChange,
  onToggle,
  disabled,
  columns = 4,
  mode = "single",
  hideLegend = false,
  variant = "default",
  tileSize = "default",
}: {
  label: string;
  options: IconGridOption[];
  value?: string;
  values?: string[];
  onChange?: (v: string) => void;
  onToggle?: (v: string) => void;
  disabled?: boolean;
  columns?: 3 | 4 | 5 | 6;
  mode?: "single" | "multi";
  hideLegend?: boolean;
  variant?: "default" | "finish" | "text";
  tileSize?: "default" | "lg";
}) {
  const isMulti = mode === "multi";
  const isText = variant === "text";
  const isFinish = variant === "finish";

  return (
    <fieldset
      className={`ds-field ${isText ? "ds-field--text" : ""} ${isFinish ? "ds-field--finish" : ""}`}
      disabled={disabled}
    >
      <legend className={hideLegend ? "ds-sr-only" : "ds-field-label"}>{label}</legend>
      <div
        className={[
          "ds-icon-grid",
          `ds-icon-grid--cols-${columns}`,
          isText ? "ds-icon-grid--text" : "",
          isFinish ? "ds-icon-grid--finish" : "",
          tileSize === "lg" ? "ds-icon-grid--lg" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role={isMulti ? "group" : "radiogroup"}
        aria-label={label}
      >
        {options.map((opt) => {
          const active = isMulti
            ? (values ?? []).includes(opt.value)
            : value === opt.value;
          const Icon = opt.icon;

          return (
            <button
              key={opt.value}
              type="button"
              className={[
                isText ? "ds-text-chip" : "ds-icon-tile",
                active ? (isText ? "ds-text-chip--active" : "ds-icon-tile--active") : "",
                isFinish ? "ds-icon-tile--finish" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-pressed={active}
              onClick={() => {
                if (isMulti && onToggle) onToggle(opt.value);
                else if (onChange) onChange(opt.value);
              }}
            >
              {active && !isText && (
                <span className="ds-icon-tile-check" aria-hidden>
                  <CheckIcon />
                </span>
              )}
              {!isText && (
                <span className="ds-icon-tile-graphic">
                  {opt.swatch ? (
                    <span
                      className="ds-icon-tile-swatch"
                      style={{ background: opt.swatch }}
                      aria-hidden
                    />
                  ) : Icon ? (
                    <Icon className="ds-icon-svg" />
                  ) : (
                    <span className="ds-icon-tile-fallback" aria-hidden />
                  )}
                </span>
              )}
              <span className={isText ? "ds-text-chip-label" : "ds-icon-tile-label"}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
