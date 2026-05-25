"use client";

import type { ReactNode } from "react";

const COLLECTIONS = [
  { label: "Wedding rings", href: "https://www.hockleymint.co.uk/wedding-rings.aspx" },
  { label: "Bespoke design", href: "https://www.hockleymint.co.uk/bespoke-design.aspx" },
  { label: "Casting services", href: "https://www.hockleymint.co.uk/casting-services.aspx" },
  { label: "About Hockley Mint", href: "https://www.hockleymint.co.uk/about.aspx" },
] as const;

const STUDIO = [
  { label: "Identify", href: "/" },
  { label: "Analyse", href: "/#design-analysis" },
  { label: "Design", href: "/design" },
  { label: "Try on", href: "#", disabled: true },
] as const;

const SOCIAL = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/hockley-mint-ltd/" },
  { label: "Instagram", href: "https://www.instagram.com/hockleymint/" },
  { label: "Facebook", href: "https://www.facebook.com/Hockleymint/" },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer-panel mt-auto">
      <div className="footer-masthead">
        <div className="footer-masthead-inner">
          <a href="/" className="footer-logo-lockup" aria-label="Hockley Mint home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hockleymint-logo-dark.svg"
              alt="Hockley Mint"
              className="footer-logo-mark"
            />
            <span className="footer-logo-tag font-logo">AI Ring Studio</span>
          </a>

          <div className="footer-legacy-wrap">
            <span className="footer-legacy-rule" aria-hidden />
            <p className="footer-legacy">
              Where <span className="footer-legacy-em">luxury</span> meets{" "}
              <span className="footer-legacy-em">legacy</span>
            </p>
            <span className="footer-legacy-rule" aria-hidden />
          </div>
        </div>
      </div>

      <div className="footer-body-wrap">
        <nav className="footer-studio-nav" aria-label="Studio modules">
          <span className="footer-studio-label font-logo">Studio</span>
          <ul className="footer-studio-list">
            {STUDIO.map((item) => (
              <li key={item.label}>
                <StudioLink
                  label={item.label}
                  href={item.href}
                  disabled={"disabled" in item && item.disabled}
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-grid">
          <section className="footer-newsletter">
            <h2 className="footer-heading">
              Keep in <span className="footer-heading-accent">touch</span>
            </h2>
            <p className="footer-body">
              Occasional updates on collections, trade shows, and sustainability from
              the factory floor.
            </p>
            <form className="footer-subscribe" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="footer-email" className="sr-only">
                Email
              </label>
              <input
                id="footer-email"
                type="email"
                placeholder="Your email"
                autoComplete="email"
                className="footer-subscribe-input"
              />
              <button type="submit" className="footer-subscribe-btn" aria-label="Subscribe">
                <ArrowIcon />
              </button>
            </form>
            <p className="footer-note">
              Research preview for catalogue matching in live demos.
            </p>
          </section>

          <div className="footer-columns">
            <LinkGroup title="Collections" links={COLLECTIONS} />
            <div>
              <h3 className="footer-col-title">Visit</h3>
              <ul className="footer-link-list">
                <li>
                  <FooterLink href="https://www.hockleymint.co.uk/contact.aspx">
                    Contact &amp; directions
                  </FooterLink>
                </li>
                <li className="footer-address">
                  65–66 Warstone Lane
                  <br />
                  Birmingham B18 6NG
                </li>
                <li>
                  <FooterLink href="tel:+4401212420042">+44 (0) 121 242 0042</FooterLink>
                </li>
                <li>
                  <FooterLink href="mailto:sales@hockleymint.co.uk" highlight>
                    sales@hockleymint.co.uk
                  </FooterLink>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="footer-col-title">Follow</h3>
              <ul className="footer-link-list">
                {SOCIAL.map((s) => (
                  <li key={s.label}>
                    <FooterLink href={s.href}>{s.label}</FooterLink>
                  </li>
                ))}
              </ul>
              <a
                href="https://www.hockleymint.co.uk"
                target="_blank"
                rel="noreferrer noopener"
                className="footer-cta"
              >
                Main website
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-ribbon">
        <p>
          <span>© {year} Hockley Mint Ltd.</span>
          <span className="footer-ribbon-sep" aria-hidden>
            ·
          </span>
          <span className="footer-ribbon-detail">
            Employee owned · RJC accredited · Birmingham since 1953
          </span>
        </p>
      </div>
    </footer>
  );
}

function StudioLink({
  label,
  href,
  disabled,
}: {
  label: string;
  href: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return <span className="footer-studio-link footer-studio-link--disabled">{label}</span>;
  }

  return (
    <a href={href} className="footer-studio-link">
      {label}
    </a>
  );
}

function LinkGroup({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="footer-col-title">{title}</h3>
      <ul className="footer-link-list">
        {links.map((link) => (
          <li key={link.label}>
            <FooterLink href={link.href}>{link.label}</FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
  highlight,
}: {
  href: string;
  children: ReactNode;
  highlight?: boolean;
}) {
  const external = href.startsWith("http") || href.startsWith("mailto") || href.startsWith("tel");
  return (
    <a
      href={href}
      target={external && href.startsWith("http") ? "_blank" : undefined}
      rel={external && href.startsWith("http") ? "noreferrer noopener" : undefined}
      className={highlight ? "footer-link footer-link--highlight" : "footer-link"}
    >
      {children}
    </a>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-[18px] w-[18px]" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H9M17 7v8" />
    </svg>
  );
}
