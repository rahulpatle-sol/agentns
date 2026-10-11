import { useId, useState, type ReactNode } from "react";

/** Roving-focus tab bar. Arrow keys move between tabs, Home/End jump to the ends. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  tabs: ReadonlyArray<{ value: T; label: string }>;
  label: string;
}) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.value === value);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    onChange(tabs[nextIndex].value);
  };

  return (
    <div
      className="tabs"
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          id={`tab-${tab.value}`}
          aria-selected={tab.value === value}
          aria-controls={`tabpanel-${tab.value}`}
          tabIndex={tab.value === value ? 0 : -1}
          className="tabs__tab"
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  value,
  active,
  children,
}: {
  value: string;
  active: string;
  children: ReactNode;
}) {
  if (value !== active) return null;
  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      style={{ marginTop: "var(--space-6)" }}
    >
      {children}
    </div>
  );
}

/** Two-or-three-way toggle, e.g. Active / Revoked filters. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Hover/focus tooltip that also works on keyboard focus, not just hover. */
export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className="tooltip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} tabIndex={0}>
        {children}
      </span>
      {open ? (
        <span className="tooltip__bubble" id={id} role="tooltip">
          {content}
        </span>
      ) : null}
    </span>
  );
}
