import type { LucideIcon, LucideProps } from "lucide-react";

export type IconProps = Omit<LucideProps, "size"> & {
  size?: number;
  /** When true, stroke uses --hm-primary (e.g. What's next sidebar). */
  accent?: boolean;
};

const DEFAULT_SIZE = 20;
const DEFAULT_STROKE = 1.75;

export function createLucideIcon(
  LucideComponent: LucideIcon,
  options?: { accent?: boolean },
) {
  function WrappedIcon({
    size = DEFAULT_SIZE,
    className,
    accent,
    strokeWidth = DEFAULT_STROKE,
    ...rest
  }: IconProps) {
    const useAccent = accent ?? options?.accent;
    return (
      <LucideComponent
        size={size}
        strokeWidth={strokeWidth}
        className={className ? `hm-icon ${className}` : "hm-icon"}
        color={useAccent ? "var(--hm-primary, #00A478)" : undefined}
        aria-hidden
        {...rest}
      />
    );
  }
  WrappedIcon.displayName = LucideComponent.displayName;
  return WrappedIcon;
}
