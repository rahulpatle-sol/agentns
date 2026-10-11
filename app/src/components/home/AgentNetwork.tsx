/**
 * Animated agent network — an original SVG illustration.
 *
 * Why inline SVG rather than a stock image or an icon font:
 *   - no network request, so nothing can 404 or slow the page down;
 *   - every colour comes from a design token, so it re-themes for free;
 *   - the motion is CSS, so it degrades to a still frame under
 *     `prefers-reduced-motion` (see the global rule in tokens.css);
 *   - no licensing question, and it is ~4 KB rather than ~200 KB.
 *
 * The diagram mirrors the real program: agents register a name, and the registry
 * account is the single source those names are verified against.
 */

type Node = {
  id: string;
  label: string;
  glyph: string;
  /** Position as a percentage of the 0 0 400 300 viewBox. */
  x: number;
  y: number;
  /** Orbit radius and speed for the floating motion, in px / seconds. */
  drift: number;
  period: number;
  delay: number;
};

const NODES: Node[] = [
  { id: 'sentiment', label: 'sentiment', glyph: 'S', x: 74, y: 64, drift: 5, period: 7, delay: 0 },
  { id: 'translate', label: 'translate', glyph: 'T', x: 322, y: 70, drift: 6, period: 8.5, delay: 0.6 },
  { id: 'embed', label: 'embed', glyph: 'E', x: 78, y: 234, drift: 5, period: 9, delay: 1.2 },
  { id: 'route', label: 'route', glyph: 'R', x: 326, y: 230, drift: 6, period: 7.5, delay: 1.8 },
];

export function AgentNetwork({ className }: { className?: string }) {
  return (
    <svg
      className={['agent-network', className].filter(Boolean).join(' ')}
      viewBox="0 0 400 300"
      role="img"
      aria-label="Diagram: four AI agents registering names with the AgentNS registry, which verifies each one on chain."
    >
      <defs>
        <radialGradient id="an-core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
          <stop offset="70%" stopColor="var(--color-primary)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="an-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-lime)" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      {/* Ambient bloom behind the registry core. */}
      <circle className="an-glow" cx="200" cy="150" r="104" fill="url(#an-core-glow)" />

      {/* Connections. The dash pattern flows toward the registry. */}
      <g className="an-edges">
        {NODES.map((node) => (
          <line
            key={node.id}
            className="an-edge"
            x1={node.x}
            y1={node.y}
            x2="200"
            y2="150"
            stroke="url(#an-edge)"
            strokeWidth="1.25"
            strokeDasharray="4 7"
          />
        ))}
      </g>

      {/* Registry core. */}
      <g className="an-core">
        <circle
          className="an-core-ring"
          cx="200"
          cy="150"
          r="46"
          fill="var(--color-surface)"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
        />
        <circle className="an-core-ring an-core-ring--outer" cx="200" cy="150" r="58" />
        <circle className="an-core-pulse" cx="200" cy="150" r="46" fill="none" stroke="var(--color-primary)" strokeWidth="1" />
        {/* Ledger glyph: three stacked lines = a record. */}
        <g stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round">
          <line x1="188" y1="142" x2="212" y2="142" />
          <line x1="188" y1="150" x2="212" y2="150" />
          <line x1="188" y1="158" x2="204" y2="158" />
        </g>
        <text className="an-core-label" x="200" y="212" textAnchor="middle">
          AgentNS registry
        </text>
      </g>

      {/* Agents. Each drifts on its own orbit and pulses when it "registers". */}
      {NODES.map((node) => (
        <g
          key={node.id}
          className="an-node"
          style={
            {
              '--an-drift': `${node.drift}px`,
              '--an-period': `${node.period}s`,
              '--an-delay': `${node.delay}s`,
            } as React.CSSProperties
          }
        >
          <circle
            className="an-node-halo"
            cx={node.x}
            cy={node.y}
            r="22"
            fill="var(--color-primary)"
            opacity="0.08"
          />
          <circle
            className="an-node-ring"
            cx={node.x}
            cy={node.y}
            r="17"
            fill="var(--color-surface-2)"
            stroke="var(--color-border-strong)"
            strokeWidth="1.25"
          />
          <text className="an-node-glyph" x={node.x} y={node.y + 4} textAnchor="middle">
            {node.glyph}
          </text>
          <text className="an-node-label" x={node.x} y={node.y + 32} textAnchor="middle">
            {node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}