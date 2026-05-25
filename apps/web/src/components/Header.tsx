"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PixelArrowIcon } from "@/components/PixelArrowIcon";

const STUDIO_LINKS = [
  { label: "Identify", href: "/", disabled: false },
  { label: "Analyse", href: "/#design-analysis", disabled: false },
  { label: "Design", href: "/design", disabled: false },
  { label: "Try on", href: "/try-on", disabled: false },
  { label: "Gallery", href: "/gallery", disabled: false },
] as const;

const CATALOGUE_URL = "https://www.hockleymint.co.uk";

function isCurrentPath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/#")) return pathname === "/";
  if (href === "#") return false;
  return pathname === href;
}

/**
 * Floating dark pill header: logo left, nav centre, white pill CTA right.
 */
export function Header() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <>
      <div className="saas-header-wrap">
        <header className="saas-header">
          <a href="/" className="saas-header-brand" aria-label="Hockley Mint home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hockleymint-logo-header.svg" alt="" aria-hidden />
          </a>

          <nav className="saas-header-nav" aria-label="Studio modules">
            {STUDIO_LINKS.map((link) =>
              link.disabled ? (
                <span key={link.label} className="saas-header-link saas-header-link--disabled">
                  {link.label}
                </span>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className={
                    mounted && isCurrentPath(pathname, link.href)
                      ? "saas-header-link saas-header-link--active"
                      : "saas-header-link"
                  }
                  aria-current={
                    mounted && isCurrentPath(pathname, link.href) ? "page" : undefined
                  }
                >
                  {link.label}
                </a>
              ),
            )}
          </nav>

          <div className="saas-header-actions">
            <a
              href={CATALOGUE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="saas-header-cta"
            >
              <span>Catalogue</span>
              <PixelArrowIcon />
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="saas-header-menu-btn"
              aria-expanded={open}
              aria-controls="studio-nav-drawer"
            >
              <span className="flex flex-col gap-[5px]" aria-hidden>
                <span className="block h-[2px] w-[20px] rounded-full bg-white" />
                <span className="block h-[2px] w-[14px] rounded-full bg-white/80" />
                <span className="block h-[2px] w-[20px] rounded-full bg-white" />
              </span>
              <span>Menu</span>
            </button>
          </div>
        </header>
      </div>

      <div
        className={`saas-drawer-backdrop fixed inset-0 z-[60] bg-ink/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
        onClick={close}
      />

      <aside
        id="studio-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Studio navigation"
        className={`saas-drawer fixed top-0 left-0 z-[70] flex h-full w-full max-w-[420px] flex-col bg-white transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-line px-6">
          <button
            type="button"
            onClick={close}
            className="flex cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-ink"
          >
            <BackCaret />
            <span className="font-display text-[1.5rem] font-medium">Back</span>
          </button>
        </div>

        <nav className="flex flex-1 flex-col px-6 py-6" aria-label="Studio">
          <p className="saas-kicker mb-8">AI Ring Studio</p>
          {STUDIO_LINKS.map((link) => (
            <NavDrawerLink
              key={link.label}
              href={link.href}
              disabled={link.disabled}
              current={mounted && isCurrentPath(pathname, link.href)}
              onNavigate={close}
            >
              {link.label}
            </NavDrawerLink>
          ))}
        </nav>

        <div className="border-t border-line px-6 py-8">
          <p className="text-[1.3rem] font-light text-muted">Hockley Mint AI Ring Studio</p>
          <a
            href={CATALOGUE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-primary mt-5 w-full"
            onClick={close}
          >
            Visit hockleymint.co.uk
          </a>
        </div>
      </aside>
    </>
  );
}

function NavDrawerLink({
  href,
  disabled,
  current,
  onNavigate,
  children,
}: {
  href: string;
  disabled?: boolean;
  current?: boolean;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  const className = `font-display flex min-h-[52px] items-center text-[2.2rem] font-medium tracking-[-0.02em] transition-[transform,color] duration-200 hover:translate-x-1 ${
    current ? "text-primary" : disabled ? "studio-nav-link--disabled text-ink" : "text-ink hover:text-primary"
  }`;

  if (disabled) {
    return <span className={className}>{children}</span>;
  }

  if (current) {
    return (
      <span className={className} aria-current="page">
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={className} onClick={onNavigate}>
      {children}
    </a>
  );
}

function BackCaret() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-ink"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}
