/** Minimal line icons for Design builder grids */

import type { ComponentType, ReactNode } from "react";

export type IconProps = { className?: string };

function IconBase({ children, className }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className ?? "ds-icon-svg"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconEngagement(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="16" cy="14" r="5" />
      <path d="M8 22c0-6 4-10 8-10s8 4 8 10" />
    </IconBase>
  );
}

export function IconWeddingBand(p: IconProps) {
  return (
    <IconBase {...p}>
      <ellipse cx="16" cy="16" rx="10" ry="6" />
    </IconBase>
  );
}

export function IconEternity(p: IconProps) {
  return (
    <IconBase {...p}>
      <ellipse cx="16" cy="16" rx="10" ry="6" />
      <circle cx="10" cy="16" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
      <circle cx="22" cy="16" r="1" fill="currentColor" />
    </IconBase>
  );
}

export function IconHalo(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="16" cy="14" r="4" />
      <circle cx="16" cy="14" r="7" strokeDasharray="2 2" />
      <path d="M8 22c0-5 4-9 8-9s8 4 8 9" />
    </IconBase>
  );
}

export function IconSolitaire(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M16 8l4 6-4 6-4-6z" />
      <path d="M8 22c0-5 4-8 8-8s8 3 8 8" />
    </IconBase>
  );
}

export function IconSignet(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="10" y="12" width="12" height="10" rx="1" />
      <ellipse cx="16" cy="22" rx="8" ry="4" />
    </IconBase>
  );
}

export function IconCluster(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="12" cy="14" r="2.5" />
      <circle cx="20" cy="14" r="2.5" />
      <circle cx="16" cy="10" r="2.5" />
      <path d="M8 22c0-5 4-8 8-8s8 3 8 8" />
    </IconBase>
  );
}

export function IconThreeStone(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="11" cy="14" r="2.5" />
      <circle cx="16" cy="12" r="3" />
      <circle cx="21" cy="14" r="2.5" />
      <path d="M8 22c0-5 4-8 8-8s8 3 8 8" />
    </IconBase>
  );
}

export function IconStoneRound(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="16" cy="16" r="8" />
      <path d="M16 8v16M8 16h16M11 11l10 10M21 11L11 21" strokeOpacity="0.45" />
    </IconBase>
  );
}

export function IconStoneOval(p: IconProps) {
  return (
    <IconBase {...p}>
      <ellipse cx="16" cy="16" rx="10" ry="7" />
      <path d="M16 9v14M6 16h20M9 12l14 8M23 12L9 20" strokeOpacity="0.45" />
    </IconBase>
  );
}

export function IconStoneEmerald(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="9" y="11" width="14" height="10" rx="1" />
      <path d="M16 11v10M9 16h14" strokeOpacity="0.45" />
    </IconBase>
  );
}

export function IconStonePrincess(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M16 8l7 8-7 8-7-8z" />
      <path d="M16 8v16M9 16h14" strokeOpacity="0.45" />
    </IconBase>
  );
}

export function IconStonePear(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M16 8c5 4 6 10 0 16-6-6-5-12 0-16z" />
      <path d="M16 8v16M11 13l10 6" strokeOpacity="0.45" />
    </IconBase>
  );
}

export function IconStoneCushion(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="8" y="10" width="16" height="12" rx="3" />
      <path d="M16 10v12M8 16h16" strokeOpacity="0.45" />
    </IconBase>
  );
}

export function IconStoneMarquise(p: IconProps) {
  return (
    <IconBase {...p}>
      <ellipse cx="16" cy="16" rx="11" ry="5" />
      <path d="M5 16h22M16 11v10" strokeOpacity="0.45" />
    </IconBase>
  );
}

export function IconStoneRadiant(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="8" y="9" width="16" height="14" rx="2" />
      <path d="M8 16h16M16 9v14M10 11l12 10M22 11L10 21" strokeOpacity="0.45" />
    </IconBase>
  );
}

export function IconStoneHeart(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M16 23s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.5 4.5 4.5 0 0 1 8 2.5c0 5.5-8 11-8 11z" />
      <path d="M12 14h8" strokeOpacity="0.45" />
    </IconBase>
  );
}

export function IconStoneAsscher(p: IconProps) {
  return (
    <IconBase {...p}>
      <rect x="9" y="9" width="14" height="14" rx="1" />
      <path d="M9 16h14M16 9v14M11 11l10 10M21 11L11 21" strokeOpacity="0.45" />
    </IconBase>
  );
}

export function IconStoneNone(p: IconProps) {
  return (
    <IconBase {...p}>
      <ellipse cx="16" cy="16" rx="10" ry="5" />
      <path d="M10 16h12" strokeDasharray="2 2" />
    </IconBase>
  );
}

export function IconSettingSolitaire(p: IconProps) {
  return <IconSolitaire {...p} />;
}

export function IconSettingHalo(p: IconProps) {
  return <IconHalo {...p} />;
}

export function IconSettingPave(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="16" cy="12" r="3" />
      <path d="M8 20c0-4 4-6 8-6s8 2 8 6" />
      <circle cx="10" cy="20" r="0.8" fill="currentColor" />
      <circle cx="14" cy="20" r="0.8" fill="currentColor" />
      <circle cx="18" cy="20" r="0.8" fill="currentColor" />
      <circle cx="22" cy="20" r="0.8" fill="currentColor" />
    </IconBase>
  );
}

export function IconBandPlain(p: IconProps) {
  return (
    <IconBase {...p}>
      <ellipse cx="16" cy="16" rx="11" ry="5" />
    </IconBase>
  );
}

export function IconBandSlim(p: IconProps) {
  return (
    <IconBase {...p}>
      <ellipse cx="16" cy="16" rx="11" ry="3" />
    </IconBase>
  );
}

export function IconBandTwisted(p: IconProps) {
  return (
    <IconBase {...p}>
      <path d="M6 18c4-8 8-8 12 0s8 8 12 0" />
    </IconBase>
  );
}

export function IconFinishPolished(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="16" cy="16" r="8" />
      <path d="M12 12l8 8M20 12l-8 8" strokeOpacity="0.3" />
    </IconBase>
  );
}

export function IconFinishMatte(p: IconProps) {
  return (
    <IconBase {...p}>
      <circle cx="16" cy="16" r="8" fill="currentColor" fillOpacity="0.08" />
    </IconBase>
  );
}

export const RING_TYPE_ICONS: Record<string, ComponentType<IconProps>> = {
  engagement: IconEngagement,
  "wedding-band": IconWeddingBand,
  eternity: IconEternity,
  halo: IconHalo,
  solitaire: IconSolitaire,
  signet: IconSignet,
  cluster: IconCluster,
  "three-stone": IconThreeStone,
};

export const STONE_ICONS: Record<string, ComponentType<IconProps>> = {
  None: IconStoneNone,
  "Round brilliant": IconStoneRound,
  Oval: IconStoneOval,
  "Emerald cut": IconStoneEmerald,
  Princess: IconStonePrincess,
  Pear: IconStonePear,
  Cushion: IconStoneCushion,
  Marquise: IconStoneMarquise,
  Radiant: IconStoneRadiant,
  Heart: IconStoneHeart,
  Asscher: IconStoneAsscher,
};
