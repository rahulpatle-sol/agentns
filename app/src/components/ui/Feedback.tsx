import type { ReactNode } from "react";

/* ----------------------------------------------------------------- Badges */

export type BadgeTone =
  "neutral" | "success" | "lime" | "warning" | "danger" | "info" | "forest";

/**
 * Status pill. Status is always communicated by an explicit word as well as
 * colour, so it is legible without colour perception.
 */
export function Badge({
  tone = "neutral",
  children,
  pulse = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  pulse?: boolean;
}) {
  const toneClass = tone === "neutral" ? "" : ` badge--${tone}`;
  return (
    <span className={`badge${toneClass}`}>
      <span className={pulse ? "dot dot--pulse" : "dot"} aria-hidden="true" />
      {children}
    </span>
  );
}

/** A badge with no dot — for static labels like a protocol name. */
export function Chip({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}

/* ----------------------------------------------------------------- Alerts */

export type AlertTone = "info" | "warning" | "danger" | "success";

const ALERT_ICON: Record<AlertTone, string> = {
  info: "ℹ",
  warning: "⚠",
  danger: "⨯",
  success: "✓",
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`alert alert--${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      <span className="alert__icon" aria-hidden="true">
        {ALERT_ICON[tone]}
      </span>
      <div className="alert__body">
        {title ? <div className="alert__title">{title}</div> : null}
        {children}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------ Empty state */

export function EmptyState({
  icon = "◇",
  title,
  children,
  action,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        <span style={{ fontSize: "1.35rem" }}>{icon}</span>
      </div>
      <p className="empty__title">{title}</p>
      {children ? <p className="empty__body">{children}</p> : null}
      {action}
    </div>
  );
}

/* --------------------------------------------------------------- Skeleton */

/**
 * Placeholder that reserves the exact height of the content it stands in for,
 * so swapping real data in does not shift the layout.
 */
export function Skeleton({
  width,
  height,
  radius,
  className,
}: {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  className?: string;
}) {
  return (
    <span
      className={["skeleton", className ?? ""].filter(Boolean).join(" ")}
      aria-hidden="true"
      style={{ display: "block", width, height, borderRadius: radius }}
    />
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className="skeleton--text"
          height={12}
          width={index === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return <Skeleton className="skeleton--card" height={120} />;
}

/* --------------------------------------------------------------- Progress */

export function Progress({
  value,
  max = 100,
  label,
}: {
  value: number;
  max?: number;
  label: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}
