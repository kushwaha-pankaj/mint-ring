import {
  ArrowRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  FolderOpen,
  Gem,
  ImageIcon,
  Images,
  LayoutGrid,
  PenTool,
  RefreshCw,
  ScanLine,
  ScanSearch,
  Upload,
  Video,
  Wand2,
  X,
} from "lucide-react";
import { createLucideIcon } from "./Icon";

export const IconUpload = createLucideIcon(Upload);
export const IconSample = createLucideIcon(Images);
export const IconCamera = createLucideIcon(Camera);
export const IconArrowRight = createLucideIcon(ArrowRight);
export const IconChevronLeft = createLucideIcon(ChevronLeft);
export const IconChevronRight = createLucideIcon(ChevronRight);
export const IconGrid = createLucideIcon(LayoutGrid);
export const IconIdentify = createLucideIcon(ScanSearch);
export const IconAnalyse = createLucideIcon(ScanLine);
export const IconDesign = createLucideIcon(PenTool);
export const IconTryOn = createLucideIcon(Gem);
export const IconGallery = createLucideIcon(Images);
export const IconBrowse = createLucideIcon(FolderOpen);
export const IconPhotoreal = createLucideIcon(ImageIcon);
export const IconLiveAR = createLucideIcon(Video);
export const IconRefresh = createLucideIcon(RefreshCw);
export const IconExternal = createLucideIcon(ExternalLink);
export const IconWand = createLucideIcon(Wand2);
export const IconClock = createLucideIcon(Clock);
export const IconClose = createLucideIcon(X);
export const IconRing = createLucideIcon(Circle);
export const IconWhatsNext = createLucideIcon(ArrowRight, { accent: true });

export const NAV_MODULE_ICONS = {
  Identify: IconIdentify,
  Analyse: IconAnalyse,
  Design: IconDesign,
  "Try on": IconTryOn,
  Gallery: IconGallery,
} as const;
