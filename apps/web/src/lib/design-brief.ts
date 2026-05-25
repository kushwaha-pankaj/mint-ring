/**
 * Design brief options and prompt builders for Module 2 (Design & Generate).
 * Core labels align with SigLIP attribute groups in apps/api/attributes/extractor.py.
 * Finish and mood are design-brief-only controls, not Analyse outputs.
 *
 * Product spec, UX invariants, mock vs real pipeline: docs/DESIGN_PAGE.md
 */

import type { Metal } from "./catalogue";
import { metalSwatch } from "./catalogue";
import type { DesignPackAssets } from "./design-pack-assets";
import { assetsForBrief } from "./design-pack-assets";
import type { InspirationUpload } from "./design-api";

export type OutputPackId = "sketch" | "hero" | "mesh" | "angles" | "lighting" | "spec";

export type OutputPackOption = { id: OutputPackId; label: string; hint: string };

export const OUTPUT_PACK_OPTIONS: OutputPackOption[] = [
  { id: "sketch", label: "Concept Sketch", hint: "Hand-drawn pencil concept" },
  { id: "hero", label: "Realistic Render", hint: "3D-style studio product shot" },
  {
    id: "mesh",
    label: "Research 3D Mesh",
    hint: "Meshy v5 multi-view GLB (~3–7 min). Set DESIGN_MESH=triposr for a fast preview only.",
  },
  { id: "angles", label: "Different Angle Views", hint: "Front, sides, and back (4 views)" },
  { id: "lighting", label: "Lighting Variations", hint: "Studio, bright, daylight, and luxury dark" },
  { id: "spec", label: "AI Specifications", hint: "Estimated design attributes" },
];

/** Fast default: hero, sketch, angles, lighting, spec — mesh opt-in on step 3. */
export const DEFAULT_OUTPUT_PACK: OutputPackId[] = [
  "hero",
  "sketch",
  "angles",
  "lighting",
  "spec",
];

export const ANGLE_VIEW_COUNT = 4;
export const LIGHTING_VARIANT_COUNT = 4;

export const PROMPT_MAX_CHARS = 500;

export const MAX_INSPIRATION_UPLOADS = 8;

export type DesignBrief = {
  ringType: string;
  metal: string;
  setting: string;
  stone: string;
  band: string;
  bandStyle: string;
  finish: string;
  /** @deprecated Use moods — kept for preset migration */
  mood: string;
  moods: string[];
  optionalDetails: string[];
  notes: string;
  outputPack: OutputPackId[];
  /** Uploaded inspiration images persisted on the backend. */
  inspirationUploads: InspirationUpload[];
};

export const EMPTY_BRIEF: DesignBrief = {
  ringType: "",
  metal: "",
  setting: "",
  stone: "",
  band: "",
  bandStyle: "",
  finish: "",
  mood: "",
  moods: [],
  optionalDetails: [] as string[],
  notes: "",
  outputPack: [...DEFAULT_OUTPUT_PACK],
  inspirationUploads: [],
};

export type ChipOption = { value: string; label: string };

export const RING_TYPE_OPTIONS: ChipOption[] = [
  { value: "engagement", label: "Engagement" },
  { value: "wedding-band", label: "Wedding band" },
  { value: "eternity", label: "Eternity" },
  { value: "halo", label: "Halo ring" },
  { value: "solitaire", label: "Solitaire" },
  { value: "signet", label: "Signet" },
  { value: "cluster", label: "Cluster" },
  { value: "three-stone", label: "Three stone" },
];

export type MetalOption = ChipOption & { swatch: string; sampleMetal: Metal };

export const METAL_OPTIONS: MetalOption[] = [
  { value: "Yellow gold", label: "Yellow gold", swatch: metalSwatch("Y"), sampleMetal: "Y" },
  { value: "White gold", label: "White gold", swatch: metalSwatch("W"), sampleMetal: "W" },
  { value: "Rose gold", label: "Rose gold", swatch: metalSwatch("R"), sampleMetal: "R" },
  { value: "Platinum", label: "Platinum", swatch: "#E5E4E2", sampleMetal: "W" },
];

export const STONE_OPTIONS: ChipOption[] = [
  { value: "None", label: "No centre stone" },
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
];

export const SETTING_OPTIONS: ChipOption[] = [
  { value: "Plain band", label: "Plain band" },
  { value: "Solitaire", label: "Solitaire" },
  { value: "Halo", label: "Halo" },
  { value: "Bezel", label: "Bezel" },
  { value: "Claw", label: "Claw" },
  { value: "Pavé", label: "Pavé" },
  { value: "Channel", label: "Channel" },
  { value: "Three stone", label: "Three stone" },
  { value: "Hidden halo", label: "Hidden halo" },
  { value: "Tension", label: "Tension" },
];

export const BAND_PROFILE_OPTIONS: ChipOption[] = [
  { value: "Court", label: "Court" },
  { value: "D-shape", label: "D-shape" },
  { value: "Flat", label: "Flat" },
  { value: "Half round", label: "Half round" },
  { value: "Knife edge", label: "Knife edge" },
];

/** Creative band style (mockup); distinct from cross-section profile. */
export const BAND_STYLE_OPTIONS: ChipOption[] = [
  { value: "Plain", label: "Plain" },
  { value: "Slim", label: "Slim" },
  { value: "Pavé", label: "Pavé" },
  { value: "Twisted", label: "Twisted" },
  { value: "Split shank", label: "Split shank" },
  { value: "Tapered", label: "Tapered" },
  { value: "Bold", label: "Bold" },
  { value: "Vintage", label: "Vintage" },
];

/** @deprecated Use BAND_PROFILE_OPTIONS */
export const BAND_OPTIONS = BAND_PROFILE_OPTIONS;

export const FINISH_OPTIONS: ChipOption[] = [
  { value: "Polished", label: "Polished" },
  { value: "Matte", label: "Matte" },
  { value: "Brushed", label: "Brushed" },
  { value: "Hammered", label: "Hammered" },
  { value: "Satin", label: "Satin" },
  { value: "Milgrain", label: "Milgrain" },
];

export const MOOD_OPTIONS: ChipOption[] = [
  { value: "Classic", label: "Classic" },
  { value: "Modern", label: "Modern" },
  { value: "Vintage", label: "Vintage" },
  { value: "Minimalist", label: "Minimalist" },
  { value: "Luxury", label: "Luxury" },
  { value: "Romantic", label: "Romantic" },
  { value: "Bold", label: "Bold" },
  { value: "Nature inspired", label: "Nature inspired" },
];

export const OPTIONAL_DETAIL_OPTIONS: ChipOption[] = [
  { value: "Hidden halo", label: "Hidden halo" },
  { value: "Side stones", label: "Side stones" },
  { value: "Engraving", label: "Engraving" },
  { value: "Milgrain", label: "Milgrain" },
  { value: "Mixed metal", label: "Mixed metal" },
  { value: "Matching band", label: "Matching band" },
  { value: "Cathedral setting", label: "Cathedral setting" },
];

export const DESIGN_PROMPT_PLACEHOLDER =
  "I want a vintage inspired engagement ring with an oval sapphire, delicate diamond halo and a slim pavé band. It should feel elegant, timeless and romantic.";

export type DesignPreset = {
  id: string;
  label: string;
  hint: string;
  brief: DesignBrief;
};

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "vintage-sapphire-halo",
    label: "Vintage sapphire halo",
    hint: "Rose gold · oval sapphire",
    brief: {
      ringType: "engagement",
      metal: "Rose gold",
      setting: "Halo",
      stone: "Oval",
      band: "Court",
      bandStyle: "Slim",
      finish: "Polished",
      mood: "Vintage",
      moods: ["Vintage", "Romantic"],
      optionalDetails: ["Side stones"],
      notes: DESIGN_PROMPT_PLACEHOLDER,
      outputPack: [...DEFAULT_OUTPUT_PACK],
      inspirationUploads: [],
    },
  },
  {
    id: "classic-solitaire",
    label: "Classic solitaire",
    hint: "White gold · engagement",
    brief: {
      ringType: "engagement",
      metal: "White gold",
      setting: "Solitaire",
      stone: "Round brilliant",
      band: "Court",
      bandStyle: "Plain",
      finish: "Polished",
      mood: "Classic",
      moods: ["Classic"],
      optionalDetails: [],
      notes: "",
      outputPack: [...DEFAULT_OUTPUT_PACK],
      inspirationUploads: [],
    },
  },
  {
    id: "heavy-court",
    label: "Heavy court band",
    hint: "Yellow gold · wedding band",
    brief: {
      ringType: "wedding-band",
      metal: "Yellow gold",
      setting: "Plain band",
      stone: "None",
      band: "Court",
      bandStyle: "Bold",
      finish: "Polished",
      mood: "Classic",
      moods: ["Classic"],
      optionalDetails: [],
      notes: "",
      outputPack: [...DEFAULT_OUTPUT_PACK],
      inspirationUploads: [],
    },
  },
  {
    id: "modern-pave",
    label: "Modern pavé",
    hint: "Rose gold · eternity",
    brief: {
      ringType: "eternity",
      metal: "Rose gold",
      setting: "Pavé",
      stone: "Round brilliant",
      band: "Half round",
      bandStyle: "Pavé",
      finish: "Polished",
      mood: "Modern",
      moods: ["Modern"],
      optionalDetails: [],
      notes: "",
      outputPack: [...DEFAULT_OUTPUT_PACK],
      inspirationUploads: [],
    },
  },
];

export function primaryMood(brief: DesignBrief): string {
  return brief.moods[0] ?? brief.mood ?? "";
}

export function moodLabel(brief: DesignBrief): string {
  const list = brief.moods.length ? brief.moods : brief.mood ? [brief.mood] : [];
  return list.join(", ");
}

export function ringTypeLabel(value: string): string {
  return RING_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function isBriefReady(brief: DesignBrief): boolean {
  return Boolean(brief.ringType && brief.metal && brief.setting);
}

export type WizardStep = 1 | 2 | 3 | 4;

export type BriefValidation = {
  /** True if the brief is complete and may be submitted to /api/design/generate. */
  ok: boolean;
  /** Per-step continue-button gate: canAdvance[step] === true ⇒ that step's
   *  Continue button is enabled. */
  canAdvance: Record<WizardStep, boolean>;
  /** Lowest step number that still has missing fields, or null if ok. */
  firstInvalidStep: WizardStep | null;
  /** Human copy explaining what is missing, keyed by step. */
  issues: Record<WizardStep, string[]>;
};

export function validateBrief(brief: DesignBrief): BriefValidation {
  const issues: Record<WizardStep, string[]> = { 1: [], 2: [], 3: [], 4: [] };

  if (!brief.ringType) issues[1].push("Choose a ring type.");
  if (!brief.metal) issues[1].push("Choose a metal.");
  if (!brief.stone) issues[1].push("Choose a centre stone shape (or No centre stone).");

  if (!brief.setting) issues[2].push("Choose a setting style.");

  if (!brief.outputPack.length) issues[3].push("Select at least one output pack item.");
  if (brief.notes.length > PROMPT_MAX_CHARS) {
    issues[3].push(`Design prompt must be ${PROMPT_MAX_CHARS} characters or fewer.`);
  }
  if (brief.inspirationUploads.length > MAX_INSPIRATION_UPLOADS) {
    issues[3].push(
      `Remove inspiration images. Maximum ${MAX_INSPIRATION_UPLOADS} allowed.`,
    );
  }

  const stepOk = (n: WizardStep) => issues[n].length === 0;
  const ok = stepOk(1) && stepOk(2) && stepOk(3);
  const canAdvance: Record<WizardStep, boolean> = {
    1: stepOk(1),
    2: stepOk(1) && stepOk(2),
    3: stepOk(1) && stepOk(2) && stepOk(3),
    4: ok,
  };
  let firstInvalidStep: WizardStep | null = null;
  for (const s of [1, 2, 3] as const) {
    if (!stepOk(s)) {
      firstInvalidStep = s;
      break;
    }
  }
  return { ok, canAdvance, firstInvalidStep, issues };
}

export function buildBriefSentence(brief: DesignBrief): string {
  if (!isBriefReady(brief)) {
    return "Choose a ring type, metal, and setting to build your brief.";
  }

  const type = ringTypeLabel(brief.ringType).toLowerCase();
  const moodVal = primaryMood(brief);
  const mood = moodVal ? `${moodVal.toLowerCase()} ` : "";
  const metal = brief.metal.toLowerCase();
  const setting = brief.setting.toLowerCase();
  const bandParts = [brief.bandStyle, brief.band].filter(Boolean).join(" ");
  const band = bandParts ? `${bandParts.toLowerCase()} band` : "band";
  const finish = brief.finish ? `${brief.finish.toLowerCase()} finish` : "";

  let stonePart = "";
  if (brief.stone && brief.stone !== "None") {
    stonePart = ` with a ${brief.stone.toLowerCase()} centre`;
  }

  const extras =
    brief.optionalDetails.length > 0
      ? `Details: ${brief.optionalDetails.join(", ")}.`
      : "";

  const parts = [
    `A ${mood}${metal} ${type}${stonePart}, ${setting} setting, ${band}`,
    finish,
    extras,
    brief.notes.trim() ? brief.notes.trim() : "",
  ].filter(Boolean);

  return parts.join(" ") + (parts.length ? "." : "");
}

export function buildPromptTemplate(brief: DesignBrief): string {
  const type = ringTypeLabel(brief.ringType).toLowerCase();
  const stone =
    brief.stone && brief.stone !== "None"
      ? ` with a ${brief.stone.toLowerCase()} centre stone`
      : "";
  const moodVal = primaryMood(brief);
  const mood = moodVal ? `${moodVal.toLowerCase()} ` : "";
  const bandDesc = [brief.bandStyle, brief.band || "court"].filter(Boolean).join(" ");
  const finish = brief.finish || "polished";
  const extras =
    brief.optionalDetails.length > 0
      ? ` ${brief.optionalDetails.join(", ")}.`
      : "";
  const notes = brief.notes.trim() ? ` ${brief.notes.trim()}` : "";

    return (
        `A ${mood}${brief.metal.toLowerCase()} ${type} ring${stone}, ` +
        `${brief.setting.toLowerCase()} setting, ${bandDesc.toLowerCase()} band, ` +
        `${finish.toLowerCase()} finish.${extras}${notes} ` +
        `One single ring only, no duplicate rings, no set of rings, no extra jewellery. ` +
        `Portrait orientation, full ring centered in frame with breathing room, ` +
        `studio product photography on a soft neutral background, ` +
        `entire ring in tack-sharp focus, deep depth of field, no bokeh, no background blur, ` +
        `no selective focus, f/16 jewellery catalogue photography, ` +
        `clean smooth metal surfaces, no jagged edges or mesh artifacts, ` +
        `crisp metal edges and stone facets throughout, ultra-detailed photorealistic render.`
    );
}

export function sketchPromptTemplate(brief: DesignBrief): string {
  const base = buildPromptTemplate(brief).replace(/\.\s*$/, "");
  return (
    `Convert the reference ring into a pure jewellery design sketch. ` +
    `Preserve the exact stone shape, band profile, prong layout, and proportions from the reference — ` +
    `do not redesign the ring. ` +
    `The entire image should be graphite pencil on warm cream paper, with visible paper grain, ` +
    `construction lines, dimension marks, soft pencil shading and hand-drawn technical detail. ` +
    `Show one front view and one three-quarter view of the exact same single ring as pencil drawings only. ` +
    `No photorealistic ring, no color render, no polished product photo, no duplicate jewellery. ` +
    `Same ring as the reference: ${base}.`
  );
}

/** @deprecated Use assetsForBrief from design-pack-assets */
export function heroImageForMetal(metal: string): string {
  return assetsForBrief({ ...EMPTY_BRIEF, metal, setting: "Halo", ringType: "engagement" }, null)
    .renderUrl;
}

export type PackStage = "sketch" | "hero" | "mesh" | "angles" | "lighting" | "spec";

export const PACK_STAGES: PackStage[] = [
  "hero",
  "sketch",
  "angles",
  "mesh",
  "lighting",
  "spec",
];

export type DesignPackState = {
  stages: Record<PackStage, boolean>;
  assets: DesignPackAssets;
  designId: string;
  prompt: string;
  sketchPrompt: string;
  latencyMs: number;
};

export function specRowsFromBrief(brief: DesignBrief): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [
    { key: "Ring type", value: ringTypeLabel(brief.ringType) },
    { key: "Metal", value: brief.metal },
    { key: "Setting", value: brief.setting },
  ];
  if (brief.stone) rows.push({ key: "Centre stone", value: brief.stone });
  if (brief.bandStyle) rows.push({ key: "Band style", value: brief.bandStyle });
  if (brief.band) rows.push({ key: "Band profile", value: brief.band });
  if (brief.finish) rows.push({ key: "Finish", value: brief.finish });
  const moodText = moodLabel(brief);
  if (moodText) rows.push({ key: "Style mood", value: moodText });
  if (brief.optionalDetails.length)
    rows.push({ key: "Extra details", value: brief.optionalDetails.join(", ") });
  return rows;
}

/** Demo estimated dimensional rows, not manufacturing truth. */
export function estimatedSpecRows(brief: DesignBrief): { key: string; value: string }[] {
  const base = specRowsFromBrief(brief);
  const width =
    brief.bandStyle === "Slim" ? "1.8 mm to 2.2 mm" : brief.bandStyle === "Bold" ? "3.0 mm to 3.5 mm" : "2.2 mm to 2.8 mm";
  const height = brief.setting === "Halo" || brief.setting === "Solitaire" ? "Medium-high" : "Low-medium";
  const weight = brief.bandStyle === "Slim" || primaryMood(brief) === "Minimalist" ? "Delicate" : "Balanced";
  const complexity =
    brief.optionalDetails.length > 2 || brief.setting === "Halo" ? "Medium-high" : "Medium";

  return [
    ...base,
    { key: "Est. band width", value: width },
    { key: "Est. setting height", value: height },
    { key: "Est. visual weight", value: weight },
    { key: "Design complexity", value: complexity },
    { key: "Style direction", value: moodLabel(brief) || "Classic" },
  ];
}
