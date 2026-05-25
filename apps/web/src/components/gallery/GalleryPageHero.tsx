import { RING_HERO_IMAGE } from "@/lib/design-pack-assets";
import { IconClock, IconGallery, IconPhotoreal, IconWand } from "@/components/icons";

type Props = {
  rangeLabel: string | null;
  packCount?: number;
  tryOnCount?: number;
};

export function GalleryPageHero({ rangeLabel, packCount, tryOnCount }: Props) {
  const hasPacks = typeof packCount === "number" && packCount > 0;

  return (
    <section className="ds-gallery-hero hm-reveal" aria-labelledby="gallery-hero-title">
      <div className="ds-gallery-hero-inner">
        <div className="ds-gallery-hero-copy">
          <p className="thread">Studio gallery</p>
          <h1 id="gallery-hero-title" className="ds-gallery-hero-title">
            Your saved design packs
          </h1>
          <p className="ds-gallery-hero-lead">
            {rangeLabel ? (
              <>
                <span className="ds-gallery-range">{rangeLabel}</span>
                {hasPacks
                  ? " · Every finished pack from this studio, grouped by creation date."
                  : " · Finished design packs will appear here automatically."}
              </>
            ) : (
              "Loading every design pack from this studio server."
            )}
          </p>

          <div className="ds-gallery-hero-stats" aria-label="Gallery summary">
            <span className="ds-gallery-hero-stat">
              <IconGallery size={18} />
              <strong>{typeof packCount === "number" ? packCount : "—"}</strong>
              design pack{packCount === 1 ? "" : "s"}
            </span>
            <span className="ds-gallery-hero-stat">
              <IconPhotoreal size={18} />
              <strong>{typeof tryOnCount === "number" ? tryOnCount : "—"}</strong>
              try-on{tryOnCount === 1 ? "" : "s"}
            </span>
            <span className="ds-gallery-hero-stat">
              <IconClock size={18} />
              {rangeLabel ?? "Current studio archive"}
            </span>
          </div>
        </div>

        <div className="ds-gallery-hero-side" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={RING_HERO_IMAGE} alt="" className="ds-gallery-hero-sketch" />
          <div className="ds-gallery-hero-side-note">
            <IconWand size={17} />
            <span>Review renders, angles, meshes, specs, and try-ons in one place.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
