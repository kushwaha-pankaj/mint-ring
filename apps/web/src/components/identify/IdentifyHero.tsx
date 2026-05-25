import { RING_HERO_IMAGE } from "@/lib/design-pack-assets";
import { IdentifySteps } from "./IdentifySteps";

export function IdentifyHero({
  currentStep,
}: {
  currentStep: number;
}) {
  return (
    <section className="ds-hero hm-reveal" aria-labelledby="identify-hero-title">
      <div className="ds-hero-top">
        <div className="ds-hero-copy">
          <h1 id="identify-hero-title" className="ds-hero-title">
            Identify your <em className="ds-hero-em">catalogue</em> match
          </h1>
          <p className="ds-hero-lead">
            Pick a sample or upload a photograph. We locate the ring and match it to
            the Hockley Mint catalogue.
          </p>
          <a href="#studio" className="ds-forest-cta id-hero-cta">
            Try a sample
          </a>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={RING_HERO_IMAGE} alt="" className="ds-hero-sketch" aria-hidden />
      </div>

      <IdentifySteps currentStep={currentStep} variant="hero" />
    </section>
  );
}
