import { RING_HERO_IMAGE } from "@/lib/design-pack-assets";
import { DesignSteps } from "./DesignSteps";

export function DesignPageHero({ currentStep }: { currentStep: number }) {
  return (
    <section className="ds-hero hm-reveal" aria-labelledby="design-hero-title">
      <div className="ds-hero-top">
        <div className="ds-hero-copy">
          <h1 id="design-hero-title" className="ds-hero-title">
            Create your <em className="ds-hero-em">perfect</em> ring
          </h1>
          <p className="ds-hero-lead">
            Design a ring that&apos;s uniquely yours in four simple steps.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={RING_HERO_IMAGE}
          alt=""
          className="ds-hero-sketch"
          aria-hidden
        />
      </div>

      <DesignSteps currentStep={currentStep} variant="hero" />
    </section>
  );
}
