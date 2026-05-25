import { RING_HERO_IMAGE } from "@/lib/design-pack-assets";

type Props = {
  rangeLabel: string | null;
  packCount?: number;
};

export function GalleryPageHero({ rangeLabel, packCount }: Props) {
  return (
    <section className="ds-hero hm-reveal" aria-labelledby="gallery-hero-title">
      <div className="ds-hero-top">
        <div className="ds-hero-copy">
          <p className="thread">Studio gallery</p>
          <h1 id="gallery-hero-title" className="ds-hero-title">
            Your saved <em className="ds-hero-em">design packs</em>
          </h1>
          <p className="ds-hero-lead">
            {rangeLabel ? (
              <>
                <span className="ds-gallery-range">{rangeLabel}</span>
                {typeof packCount === "number" && packCount > 0 ? (
                  <>
                    {" "}
                    · {packCount} pack{packCount === 1 ? "" : "s"} grouped by date.
                  </>
                ) : (
                  " · Grouped by date from this studio server."
                )}
              </>
            ) : (
              <>
                Loading every design pack from this studio server, grouped by date.
              </>
            )}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={RING_HERO_IMAGE} alt="" className="ds-hero-sketch" aria-hidden />
      </div>
    </section>
  );
}
