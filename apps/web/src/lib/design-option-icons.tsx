/**
 * Lucide-backed icons for all design wizard steps (1–4).
 */
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Asterisk,
  Box,
  Circle,
  CircleDot,
  CircleOff,
  ClipboardList,
  Columns2,
  Crown,
  Diamond,
  Eclipse,
  Expand,
  Flower2,
  Gem,
  GitBranch,
  GripHorizontal,
  Heart,
  Infinity,
  Landmark,
  LayoutGrid,
  Leaf,
  Link2,
  Minus,
  Octagon,
  Palette,
  PenLine,
  Pencil,
  Plus,
  RectangleHorizontal,
  Layers,
  RotateCw,
  Square,
  Sun,
  Squircle,
  Triangle,
  Zap,
} from "lucide-react";
import type { OutputPackId } from "@/lib/design-brief";
import { IconThreeStone } from "@/components/design/design-icons";

export type ReviewAttrKind =
  | "ring"
  | "metal"
  | "stone"
  | "setting"
  | "band"
  | "finish"
  | "extra"
  | "mood";

export type DesignTileIcon = ComponentType<{ className?: string }>;

export function lucideTile(
  Icon: LucideIcon,
  options?: { size?: number; strokeWidth?: number },
): DesignTileIcon {
  const size = options?.size ?? 28;
  const strokeWidth = options?.strokeWidth ?? 1.35;
  return function DesignLucideIcon({ className }: { className?: string }) {
    return (
      <Icon
        className={className ?? "ds-icon-svg"}
        size={size}
        strokeWidth={strokeWidth}
        aria-hidden
      />
    );
  };
}

/** Setting style (head + basket). */
export const SETTING_STYLE_ICONS: Record<string, DesignTileIcon> = {
  Solitaire: lucideTile(Gem),
  Halo: lucideTile(Eclipse),
  Bezel: lucideTile(CircleDot),
  Pavé: lucideTile(GripHorizontal),
  "Three stone": IconThreeStone,
  Channel: lucideTile(Columns2),
  "Hidden halo": lucideTile(Eclipse),
  Claw: lucideTile(Asterisk),
  Tension: lucideTile(ArrowLeftRight),
  "Plain band": lucideTile(Circle),
};

/** Creative band style (Step 2 mockup). */
export const BAND_STYLE_ICONS: Record<string, DesignTileIcon> = {
  Plain: lucideTile(Circle),
  Pavé: lucideTile(GripHorizontal),
  Twisted: lucideTile(Infinity),
  "Split shank": lucideTile(GitBranch),
  Tapered: lucideTile(Triangle),
  Slim: lucideTile(Minus, { strokeWidth: 1 }),
  Bold: lucideTile(Circle, { strokeWidth: 2.4 }),
  Vintage: lucideTile(Flower2),
  "Knife edge": lucideTile(Triangle, { strokeWidth: 1.8 }),
};

/** Band cross-section profile (legacy brief form). */
export const BAND_PROFILE_ICONS: Record<string, DesignTileIcon> = {
  Court: lucideTile(Circle),
  "D-shape": lucideTile(CircleDot),
  Flat: lucideTile(Square),
  "Half round": lucideTile(Circle, { strokeWidth: 1 }),
  "Knife edge": lucideTile(Triangle),
};

/** Optional extras — multi-select tiles. */
export const EXTRA_DETAIL_ICONS: Record<string, DesignTileIcon> = {
  "Hidden halo": lucideTile(Eclipse),
  "Side stones": lucideTile(Gem),
  Engraving: lucideTile(PenLine),
  Milgrain: lucideTile(GripHorizontal, { strokeWidth: 1.1 }),
  "Mixed metal": lucideTile(Palette),
  "Matching band": lucideTile(Link2),
  "Cathedral setting": lucideTile(Landmark),
};

/** Style mood (brief form). */
export const MOOD_ICONS: Record<string, DesignTileIcon> = {
  Classic: lucideTile(Crown),
  Modern: lucideTile(Zap),
  Vintage: lucideTile(Flower2),
  Minimalist: lucideTile(Minus),
  Luxury: lucideTile(Gem),
  Romantic: lucideTile(Heart),
  Bold: lucideTile(Expand),
  "Nature inspired": lucideTile(Leaf),
};

export const FINISH_SWATCHES: Record<string, string> = {
  Polished: "linear-gradient(145deg, #e8c872 0%, #c9a227 45%, #f5e6a8 100%)",
  Matte: "linear-gradient(145deg, #9a9a9a 0%, #6e6e6e 100%)",
  Brushed: "linear-gradient(145deg, #b8b8b8 0%, #8a8a8a 100%)",
  Hammered: "linear-gradient(145deg, #a8a8a8 0%, #787878 100%)",
  Satin: "linear-gradient(145deg, #c4c4c4 0%, #989898 100%)",
  Milgrain: "linear-gradient(145deg, #c0b8a8 0%, #8a8278 100%)",
};

export function settingStyleIcon(value: string): DesignTileIcon {
  return SETTING_STYLE_ICONS[value] ?? lucideTile(Gem);
}

export function bandStyleIcon(value: string): DesignTileIcon {
  return BAND_STYLE_ICONS[value] ?? lucideTile(Circle);
}

export function bandProfileIcon(value: string): DesignTileIcon {
  return BAND_PROFILE_ICONS[value] ?? lucideTile(Circle);
}

export function extraDetailIcon(value: string): DesignTileIcon {
  return EXTRA_DETAIL_ICONS[value] ?? lucideTile(Gem);
}

export function moodIcon(value: string): DesignTileIcon {
  return MOOD_ICONS[value] ?? lucideTile(Box);
}

/** Step 1 — ring type. */
export const RING_TYPE_ICONS: Record<string, DesignTileIcon> = {
  engagement: lucideTile(Heart),
  "wedding-band": lucideTile(Circle),
  eternity: lucideTile(Infinity),
  halo: lucideTile(Eclipse),
  solitaire: lucideTile(Gem),
  cluster: lucideTile(LayoutGrid),
  "three-stone": IconThreeStone,
};

/** Step 1 — centre stone shape. */
export const STONE_SHAPE_ICONS: Record<string, DesignTileIcon> = {
  "Round brilliant": lucideTile(Circle),
  Oval: lucideTile(Squircle),
  "Emerald cut": lucideTile(RectangleHorizontal),
  Pear: lucideTile(Triangle),
  Cushion: lucideTile(Square),
  Marquise: lucideTile(Diamond),
  Princess: lucideTile(Diamond, { strokeWidth: 1.6 }),
  Radiant: lucideTile(Octagon),
  Heart: lucideTile(Heart),
  Asscher: lucideTile(Square, { strokeWidth: 1.6 }),
  None: lucideTile(CircleOff),
};

/** Step 3 & 4 — output pack stages. */
export const OUTPUT_PACK_ICONS: Record<OutputPackId, DesignTileIcon> = {
  sketch: lucideTile(Pencil),
  hero: lucideTile(Gem),
  mesh: lucideTile(Box),
  angles: lucideTile(RotateCw),
  lighting: lucideTile(Sun),
  spec: lucideTile(ClipboardList),
};

/** Step 4 — brief review row icons. */
export const REVIEW_ATTR_ICONS: Record<ReviewAttrKind, DesignTileIcon> = {
  ring: lucideTile(Gem, { size: 18, strokeWidth: 1.3 }),
  metal: lucideTile(CircleDot, { size: 18, strokeWidth: 1.3 }),
  stone: lucideTile(Diamond, { size: 18, strokeWidth: 1.3 }),
  setting: lucideTile(Layers, { size: 18, strokeWidth: 1.3 }),
  band: lucideTile(Circle, { size: 18, strokeWidth: 1.3 }),
  finish: lucideTile(Circle, { size: 18, strokeWidth: 1.3 }),
  extra: lucideTile(Plus, { size: 18, strokeWidth: 1.3 }),
  mood: lucideTile(Heart, { size: 18, strokeWidth: 1.3 }),
};

export function ringTypeIcon(value: string): DesignTileIcon {
  return RING_TYPE_ICONS[value] ?? lucideTile(Gem);
}

export function stoneShapeIcon(value: string): DesignTileIcon {
  return STONE_SHAPE_ICONS[value] ?? lucideTile(Diamond);
}

export function outputPackIcon(id: OutputPackId): DesignTileIcon {
  return OUTPUT_PACK_ICONS[id];
}

/** Larger icons for step 4 preview cards. */
export function outputPackPreviewIcon(id: OutputPackId): DesignTileIcon {
  const map: Record<OutputPackId, LucideIcon> = {
    sketch: Pencil,
    hero: Gem,
    mesh: Box,
    angles: RotateCw,
    lighting: Sun,
    spec: ClipboardList,
  };
  return lucideTile(map[id], { size: 36, strokeWidth: 1.25 });
}

export function reviewAttrIcon(kind: string): DesignTileIcon {
  return REVIEW_ATTR_ICONS[kind as ReviewAttrKind] ?? lucideTile(Gem, { size: 18 });
}
