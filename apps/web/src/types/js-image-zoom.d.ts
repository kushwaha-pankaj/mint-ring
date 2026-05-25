declare module "js-image-zoom" {
  export interface ImageZoomOptions {
    width?: number;
    height?: number;
    zoomWidth?: number;
    img?: string;
    scale?: number;
    offset?: { vertical: number; horizontal: number };
    zoomStyle?: string;
    zoomLensStyle?: string;
    zoomPosition?: "top" | "left" | "bottom" | "right" | "original";
    zoomContainer?: HTMLElement;
  }

  export interface ImageZoomInstance {
    setup: () => void;
    kill: () => void;
  }

  export default function ImageZoom(
    container: HTMLElement,
    options: ImageZoomOptions,
  ): ImageZoomInstance;
}
