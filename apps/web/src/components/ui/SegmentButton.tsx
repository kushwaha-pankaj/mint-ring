import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type SegmentSize = "sm" | "md" | "lg";

const SIZE_GROUP: Record<SegmentSize, string> = {
  sm: "hm-segment-group--sm",
  md: "hm-segment-group--md",
  lg: "hm-segment-group--lg",
};

const SIZE_BTN: Record<SegmentSize, string> = {
  sm: "hm-segment-btn--sm",
  md: "hm-segment-btn--md",
  lg: "hm-segment-btn--lg",
};

export function SegmentGroup({
  className,
  size = "md",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { size?: SegmentSize }) {
  return (
    <div
      className={["hm-segment-group", SIZE_GROUP[size], className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SegmentButton({
  active,
  icon,
  className,
  size = "md",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
  size?: SegmentSize;
}) {
  return (
    <button
      type="button"
      className={[
        "hm-segment-btn",
        SIZE_BTN[size],
        active ? "hm-segment-btn--on" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={active}
      {...rest}
    >
      {icon ? <span className="hm-segment-btn__icon">{icon}</span> : null}
      {children ? <span className="hm-segment-btn__label">{children}</span> : null}
    </button>
  );
}

/** Tab-style segment with title + optional meta line (Try-on mode tabs). */
export function SegmentTab({
  active,
  label,
  meta,
  icon,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  label: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={["hm-segment-tab", active ? "hm-segment-tab--on" : "", className]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={active}
      {...rest}
    >
      {icon ? <span className="hm-segment-tab__icon">{icon}</span> : null}
      <span className="hm-segment-tab__body">
        <span className="hm-segment-tab__label">{label}</span>
        {meta ? <span className="hm-segment-tab__meta">{meta}</span> : null}
      </span>
    </button>
  );
}

export function SegmentTabList({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["hm-segment-tablist", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}
