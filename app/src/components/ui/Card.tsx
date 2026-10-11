import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "sunken";
  flush?: boolean;
};

/** Surface container. Use for any grouped panel: forms, lists, metric blocks. */
export function Card({
  variant = "default",
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [
    "card",
    variant === "sunken" ? "card--sunken" : "",
    flush ? "card--flush" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  id,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  id?: string;
}) {
  return (
    <div className="card__header">
      <div style={{ minWidth: 0 }}>
        <h2 className="card__title" id={id}>
          {title}
        </h2>
        {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="card__header-actions">{actions}</div> : null}
    </div>
  );
}

export function CardBody({
  tight = false,
  children,
  ...rest
}: { tight?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={tight ? "card__body card__body--tight" : "card__body"}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <div className="card__footer">{children}</div>;
}

/* ------------------------------------------------------------------ Stats */

export function Stat({
  label,
  value,
  hint,
  size = "md",
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  size?: "md" | "sm";
  tone?: "default" | "positive" | "muted";
}) {
  const valueColor =
    tone === "positive"
      ? "var(--color-action)"
      : tone === "muted"
        ? "var(--color-muted)"
        : "var(--color-forest)";

  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span
        className={
          size === "sm" ? "stat__value stat__value--sm" : "stat__value"
        }
        style={{ color: valueColor }}
      >
        {value}
      </span>
      {hint ? <span className="stat__hint">{hint}</span> : null}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}
