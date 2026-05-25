/**
 * Static demo assets for the Design pack (mock generation).
 * Curated ring imagery lives in public/design; see ATTRIBUTION.md.
 */

import type { DesignBrief } from "./design-brief";

export type DesignPackAssets = {
  sketchUrl: string;
  renderUrl: string;
  angleUrls: { label: string; url: string }[];
  lightingUrls: { label: string; url: string; tint?: "studio" | "bright" | "day" | "warm" | "dark" }[];
};

export const RING_HERO_IMAGE = "/design/ringimage.png";
const SKETCH_IMAGE = "/design/pack/sapphire-sketch.svg";

const ANGLE_LABELS = [
  { label: "Front View", url: "/design/pack/sapphire-front.jpg" },
  { label: "45° Angle", url: "/design/pack/sapphire-render.jpg" },
  { label: "Side View", url: "/design/pack/sapphire-side.jpg" },
  { label: "Top View", url: "/design/pack/sapphire-top.jpg" },
  { label: "Back View", url: "/design/pack/metal-rose-render.jpg" },
  { label: "Angled Side", url: "/design/pack/sapphire-render.jpg" },
  { label: "Tilted Top", url: "/design/pack/sapphire-front.jpg" },
  { label: "Close Up", url: "/design/pack/sapphire-close.jpg" },
];

const LIGHTING_VARIANTS: DesignPackAssets["lightingUrls"] = [
  { label: "Soft Studio", url: "/design/pack/light-studio.jpg", tint: "studio" },
  { label: "Bright Light", url: "/design/pack/light-bright.jpg", tint: "bright" },
  { label: "Natural Daylight", url: "/design/pack/light-daylight.jpg", tint: "day" },
  { label: "Warm Light", url: "/design/pack/light-warm.jpg", tint: "warm" },
  { label: "Luxury Dark", url: "/design/pack/light-dark.jpg", tint: "dark" },
];

function defaultPack(): DesignPackAssets {
  return {
    sketchUrl: SKETCH_IMAGE,
    renderUrl: "/design/pack/sapphire-render.jpg",
    angleUrls: ANGLE_LABELS,
    lightingUrls: LIGHTING_VARIANTS,
  };
}

/** Resolve curated pack images for mock generation. */
export function assetsForBrief(
  _brief: DesignBrief,
  _presetId: string | null,
): DesignPackAssets {
  return defaultPack();
}

export function designIdFromBrief(brief: DesignBrief): string {
  const raw = JSON.stringify(brief);
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  return `HM-2026-${(h % 100000).toString().padStart(5, "0")}`;
}
