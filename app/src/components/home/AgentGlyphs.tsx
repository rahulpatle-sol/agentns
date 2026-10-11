/**
 * Animated agent task glyphs — four original SVG illustrations, one per agent
 * capability, each showing that agent doing its actual job.
 *
 * Same reasoning as AgentNetwork: inline SVG, token-coloured, CSS-animated, and
 * still under reduced motion. Each glyph pairs with real functionality the
 * program supports, so nothing on screen is decorative fiction.
 */

type GlyphProps = { className?: string; label: string };

const base = {
  viewBox: '0 0 64 64',
  className: 'agent-glyph',
  role: 'img' as const,
};

/** 1 — reasoning: a spinner arc walking while tokens are produced. */
function ReasoningGlyph({ className, label }: GlyphProps) {
  return (
    <svg {...base} className={[base.className, className].filter(Boolean).join(' ')} aria-label={label}>
      <circle className="ag-track" cx="32" cy="32" r="20" />
      <circle className="ag-spin ag-spin--cw" cx="32" cy="32" r="20" />
      <circle className="ag-dot" cx="32" cy="32" r="5" />
    </svg>
  );
}

/** 2 — tool call: a socket pulses and a signal travels out to a tool. */
function ToolCallGlyph({ className, label }: GlyphProps) {
  return (
    <svg {...base} className={[base.className, className].filter(Boolean).join(' ')} aria-label={label}>
      <circle className="ag-track" cx="32" cy="32" r="6" />
      <circle className="ag-beat" cx="32" cy="32" r="6" fill="none" stroke="var(--color-lime)" strokeWidth="1.5" />
      <circle className="ag-node" cx="32" cy="12" r="4" />
      <circle className="ag-node" cx="51" cy="44" r="4" />
      <circle className="ag-node" cx="13" cy="44" r="4" />
      <line className="ag-wire" x1="32" y1="26" x2="32" y2="16" />
      <line className="ag-wire ag-wire--d2" x1="37" y1="35" x2="47" y2="42" />
      <line className="ag-wire ag-wire--d3" x1="27" y1="35" x2="17" y2="42" />
    </svg>
  );
}

/** 3 — streaming: an endpoint emitting a packet stream. */
function StreamGlyph({ className, label }: GlyphProps) {
  return (
    <svg {...base} className={[base.className, className].filter(Boolean).join(' ')} aria-label={label}>
      <circle className="ag-ring" cx="18" cy="32" r="8" />
      <circle className="ag-pulse ag-pulse--1" cx="18" cy="32" r="8" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" />
      <circle className="ag-pulse ag-pulse--2" cx="18" cy="32" r="8" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" />
      <circle className="ag-pulse ag-pulse--3" cx="18" cy="32" r="8" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" />
      <g className="ag-bars">
        <rect className="ag-bar ag-bar--1" x="34" y="26" width="4" height="12" rx="2" />
        <rect className="ag-bar ag-bar--2" x="42" y="20" width="4" height="24" rx="2" />
        <rect className="ag-bar ag-bar--3" x="50" y="28" width="4" height="8" rx="2" />
      </g>
    </svg>
  );
}

/** 4 — verified: a checkmark drawn over a sealed record. */
function VerifiedGlyph({ className, label }: GlyphProps) {
  return (
    <svg {...base} className={[base.className, className].filter(Boolean).join(' ')} aria-label={label}>
      <rect className="ag-doc" x="14" y="12" width="36" height="40" rx="5" />
      <line className="ag-line" x1="22" y1="24" x2="42" y2="24" />
      <line className="ag-line" x1="22" y1="32" x2="38" y2="32" />
      <circle className="ag-badge" cx="44" cy="44" r="13" />
      <path className="ag-check" d="M38 44.5 l4.2 4.2 L50.5 40.5" fill="none" stroke="var(--color-ink)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const AGENT_GLYPHS = {
  reasoning: ReasoningGlyph,
  toolCall: ToolCallGlyph,
  stream: StreamGlyph,
  verified: VerifiedGlyph,
} as const;

export type AgentGlyphKind = keyof typeof AGENT_GLYPHS;