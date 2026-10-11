import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copies text to the clipboard and confirms it inline. Falls back to a hidden
 * textarea + execCommand where the async Clipboard API is unavailable (http
 * origins, older WebViews), so the control is never a dead button.
 */
export function CopyButton({
  value,
  label = "Copy",
  size = 14,
}: {
  value: string;
  label?: string;
  size?: number;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const scratch = document.createElement("textarea");
        scratch.value = value;
        scratch.setAttribute("readonly", "");
        scratch.style.position = "fixed";
        scratch.style.opacity = "0";
        document.body.appendChild(scratch);
        scratch.select();
        document.execCommand("copy");
        document.body.removeChild(scratch);
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; leave the control un-confirmed rather
      // than claiming a copy that did not happen.
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type="button"
      className={copied ? "copy-btn copy-btn--copied" : "copy-btn"}
      onClick={onCopy}
      aria-label={copied ? "Copied to clipboard" : label}
      title={copied ? "Copied" : label}
    >
      <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1 }}>
        {copied ? "✓" : "⧉"}
      </span>
    </button>
  );
}

/** An address rendered with its full value available to assistive tech. */
export function AddressChip({
  value,
  shorten,
  label,
}: {
  value: string;
  shorten: (value: string) => string;
  label?: string;
}) {
  return (
    <span
      className="inline-link mono"
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      <span title={value} aria-label={label ? `${label}: ${value}` : value}>
        {shorten(value)}
      </span>
      <CopyButton
        value={value}
        label={`Copy ${label ?? "address"}`}
        size={12}
      />
    </span>
  );
}
