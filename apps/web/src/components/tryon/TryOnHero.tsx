import { RING_HERO_IMAGE } from "@/lib/design-pack-assets";

export function TryOnHero() {
  return (
    <section className="ds-hero ds-hero--tryon-compact hm-reveal" aria-labelledby="tryon-hero-title">
      <div className="ds-hero-top">
        <div className="ds-hero-copy">
          <h1 id="tryon-hero-title" className="ds-hero-title">
            See your ring <em className="ds-hero-em">on your hand</em>
          </h1>
          <p className="ds-hero-lead">
            Preview your pack, add a hand photo, then refine with FLUX or live AR on the mesh.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={RING_HERO_IMAGE} alt="" className="ds-hero-sketch" aria-hidden />
      </div>
    </section>
  );
}
