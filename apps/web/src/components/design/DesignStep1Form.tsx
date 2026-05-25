"use client";

import type { ReactNode } from "react";
import type { DesignBrief } from "@/lib/design-brief";
import { ringTypeIcon, stoneShapeIcon } from "@/lib/design-option-icons";

/** Step 1 options, labels match the design mockup. */
const STEP1_RING_TYPES = [
  { value: "engagement", label: "Engagement" },
  { value: "wedding-band", label: "Wedding Band" },
  { value: "eternity", label: "Eternity" },
  { value: "halo", label: "Halo" },
  { value: "solitaire", label: "Solitaire" },
  { value: "cluster", label: "Cluster" },
  { value: "three-stone", label: "Three Stone" },
] as const;

const STEP1_METALS = [
  {
    value: "Yellow gold",
    label: "Yellow Gold",
    swatch: "radial-gradient(circle at 32% 28%, #fff1b2 0%, #d7aa24 42%, #9d7614 100%)",
  },
  {
    value: "White gold",
    label: "White Gold",
    swatch: "radial-gradient(circle at 32% 28%, #ffffff 0%, #d6d8d5 46%, #8f938e 100%)",
  },
  {
    value: "Rose gold",
    label: "Rose Gold",
    swatch: "radial-gradient(circle at 32% 28%, #ffd3bd 0%, #c77b61 48%, #8e503d 100%)",
  },
  {
    value: "Platinum",
    label: "Platinum",
    swatch: "radial-gradient(circle at 32% 28%, #ffffff 0%, #c7cbc7 46%, #8a8e88 100%)",
  },
] as const;

const STEP1_STONES = [
  { value: "Round brilliant", label: "Round" },
  { value: "Oval", label: "Oval" },
  { value: "Emerald cut", label: "Emerald" },
  { value: "Pear", label: "Pear" },
  { value: "Cushion", label: "Cushion" },
  { value: "Marquise", label: "Marquise" },
  { value: "Princess", label: "Princess" },
  { value: "Radiant", label: "Radiant" },
  { value: "Heart", label: "Heart" },
  { value: "Asscher", label: "Asscher" },
  { value: "None", label: "No centre stone" },
] as const;

export function DesignStep1Form({
  brief,
  onChange,
  onNext,
  disabled,
  canNext,
}: {
  brief: DesignBrief;
  onChange: (patch: Partial<DesignBrief>) => void;
  onNext: () => void;
  disabled?: boolean;
  canNext: boolean;
}) {
  return (
    <>
      <div className="ds-step1-columns">
        <section className="ds-step1-col" aria-labelledby="ds-step1-ring-type">
          <h3 id="ds-step1-ring-type" className="ds-step1-section-label">
            1. Ring Type
          </h3>
          <div className="ds-step1-grid ds-step1-grid--ring" role="radiogroup" aria-labelledby="ds-step1-ring-type">
            {STEP1_RING_TYPES.map((opt) => {
              const Icon = ringTypeIcon(opt.value);
              return (
                <Step1Tile
                  key={opt.value}
                  label={opt.label}
                  active={brief.ringType === opt.value}
                  disabled={disabled}
                  onClick={() => onChange({ ringType: opt.value })}
                >
                  {Icon ? <Icon className="ds-step1-icon" /> : null}
                </Step1Tile>
              );
            })}
          </div>
        </section>

        <section className="ds-step1-col" aria-labelledby="ds-step1-metal">
          <h3 id="ds-step1-metal" className="ds-step1-section-label">
            2. Metal
          </h3>
          <div className="ds-step1-grid ds-step1-grid--metal" role="radiogroup" aria-labelledby="ds-step1-metal">
            {STEP1_METALS.map((opt) => (
              <Step1Tile
                key={opt.value}
                label={opt.label}
                active={brief.metal === opt.value}
                disabled={disabled}
                onClick={() => onChange({ metal: opt.value })}
              >
                <span
                  className="ds-step1-metal-sphere"
                  style={{ background: opt.swatch }}
                  aria-hidden
                />
              </Step1Tile>
            ))}
          </div>
        </section>

        <section className="ds-step1-col" aria-labelledby="ds-step1-stone">
          <h3 id="ds-step1-stone" className="ds-step1-section-label">
            3. Centre Stone Shape
          </h3>
          <div className="ds-step1-grid ds-step1-grid--stone" role="radiogroup" aria-labelledby="ds-step1-stone">
            {STEP1_STONES.map((opt) => {
              const Icon = stoneShapeIcon(opt.value);
              return (
                <Step1Tile
                  key={opt.value}
                  label={opt.label}
                  active={brief.stone === opt.value}
                  disabled={disabled}
                  onClick={() => onChange({ stone: opt.value })}
                >
                  {Icon ? <Icon className="ds-step1-icon ds-step1-icon--stone" /> : null}
                </Step1Tile>
              );
            })}
          </div>
        </section>
      </div>

      <div className="ds-step1-actions">
        <button
          type="button"
          className="ds-forest-cta"
          disabled={!canNext || disabled}
          onClick={onNext}
        >
          Continue to Design Details
          <ChevronRightIcon />
        </button>
      </div>
    </>
  );
}

function Step1Tile({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={["ds-step1-tile", active ? "ds-step1-tile--active" : ""].filter(Boolean).join(" ")}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {active && (
        <span className="ds-step1-tile-check" aria-hidden>
          <CheckIcon />
        </span>
      )}
      <span className="ds-step1-tile-graphic">{children}</span>
      <span className="ds-step1-tile-label">{label}</span>
    </button>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" className="ds-forest-cta__chevron" fill="none" aria-hidden>
      <path
        d="M8 5l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
