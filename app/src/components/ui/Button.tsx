import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Shows a spinner and blocks interaction while a transaction is in flight. */
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  /**
   * Explains *why* the button is disabled. Rendered next to the button by the
   * caller rather than hidden in a tooltip, so it is reachable on touch.
   */
  disabledReason?: string;
};

/**
 * The single button primitive. Disabled buttons keep their label and get an
 * accessible description from `aria-describedby` when a reason is supplied, so
 * screen-reader users are told why an action is unavailable instead of just
 * hearing "unavailable".
 */
export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  loading = false,
  leadingIcon,
  trailingIcon,
  disabledReason,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const classes = [
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    block ? "btn--block" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={block ? "btn-wrap" : undefined}
      style={block ? { display: "block" } : undefined}
    >
      <button
        type={type}
        className={classes}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-describedby={
          disabledReason && isDisabled ? "btn-disabled-reason" : undefined
        }
        {...rest}
      >
        {loading ? (
          <span className="spinner spinner--sm" aria-hidden="true" />
        ) : (
          leadingIcon
        )}
        <span>{children}</span>
        {!loading && trailingIcon}
      </button>
      {disabledReason && isDisabled ? (
        <span
          id="btn-disabled-reason"
          className="field__hint"
          style={{ display: "block", marginTop: "var(--space-2)" }}
        >
          {disabledReason}
        </span>
      ) : null}
    </span>
  );
}

/** Indeterminate progress indicator. Colour follows the surrounding context. */
export function Spinner({
  size = "md",
  label,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  return (
    <span
      className={`spinner spinner--${size}`}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
