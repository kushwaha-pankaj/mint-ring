import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "ghost" | "outline" | "dark";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  outline: "btn-outline",
  dark: "btn-dark",
};

type CommonProps = {
  variant?: ButtonVariant;
  className?: string;
  icon?: ReactNode;
  iconPosition?: "start" | "end";
  children?: ReactNode;
};

type ButtonProps = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { as?: "button" };

type LinkProps = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { as: "a" };

export type HmButtonProps = ButtonProps | LinkProps;

function mergeClass(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Button(props: HmButtonProps) {
  const {
    variant = "primary",
    className,
    icon,
    iconPosition = "end",
    children,
    as,
    ...rest
  } = props;

  const classes = mergeClass(VARIANT_CLASS[variant], className);
  const content = (
    <>
      {icon && iconPosition === "start" ? (
        <span className="hm-btn__icon hm-btn__icon--start">{icon}</span>
      ) : null}
      {children ? <span className="hm-btn__label">{children}</span> : null}
      {icon && iconPosition === "end" ? (
        <span className="hm-btn__icon hm-btn__icon--end">{icon}</span>
      ) : null}
    </>
  );

  if (as === "a") {
    const { as: _a, variant: _v, icon: _i, iconPosition: _p, ...linkRest } =
      rest as LinkProps;
    return (
      <a className={classes} {...linkRest}>
        {content}
      </a>
    );
  }

  const { variant: _v, icon: _i, iconPosition: _p, ...buttonRest } =
    rest as ButtonProps;
  return (
    <button type="button" className={classes} {...buttonRest}>
      {content}
    </button>
  );
}
