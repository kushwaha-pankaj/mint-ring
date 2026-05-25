import { IconSample, IconUpload } from "@/components/icons";
import { Button } from "@/components/ui";

export function Hero() {
  return (
    <section className="saas-hero hm-reveal" aria-labelledby="hero-title">
      <div className="saas-hero-card">
        <div className="saas-hero-inner">
          <h1 id="hero-title" className="saas-hero-title font-display">
            Identify any Hockley Mint ring from a single photograph.
          </h1>
          <p className="saas-hero-lead">
            Pick a sample or bring your own photograph. We locate the ring in
            your image and match it to the Hockley Mint catalogue.
          </p>
          <div className="saas-hero-actions">
            <Button
              as="a"
              href="#studio"
              variant="primary"
              className="saas-hero-cta"
              icon={<IconSample size={18} />}
              iconPosition="start"
            >
              Try a sample
            </Button>
            <Button
              as="a"
              href="#studio"
              variant="outline"
              className="saas-hero-cta"
              icon={<IconUpload size={18} />}
              iconPosition="start"
            >
              Upload a photograph
            </Button>
          </div>
        </div>

        <div className="saas-hero-app" aria-hidden>
          <div className="saas-app-sidebar">
            <span className="saas-app-logo-dot" />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="saas-app-main">
            <p className="saas-app-greeting">Hello, Hockley Mint</p>
            <h2>How can I identify this ring?</h2>
            <div className="saas-app-cards">
              <span>Sample</span>
              <span>Upload</span>
              <span>Camera</span>
            </div>
            <div className="saas-app-prompt">
              <span>Drop a ring photograph or choose a sample</span>
              <b>→</b>
            </div>
          </div>
        </div>
      </div>

      <div className="saas-logo-strip" aria-label="Studio capabilities">
        <span>Identify</span>
        <span>Analyse</span>
        <span>Design</span>
        <span>Try on</span>
      </div>
    </section>
  );
}
