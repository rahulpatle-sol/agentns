import { Link } from 'react-router-dom';

import { AgentNetwork } from '../components/home/AgentNetwork';
import { heroLineReveal, marqueeLoop, parallax, revealOnScroll } from '../animations/gsap';
import { useGsapEffect } from '../animations/useGsapEffect';
import { Button } from '../components/ui/Button';

/**
 * Cinematic homepage.
 *
 * Every claim here maps to something the program actually does. There is no
 * TVL, no volume and no user count, because AgentNS has none of those and
 * inventing them would be the single most damaging thing this page could do.
 */
export function HomePage() {
  return (
    <div className="home">
      <Hero />
      <Marquee />
      <Protocol />
      <Showcase />
      <FinalCta />
    </div>
  );
}

/* --------------------------------------------------------------------- Hero */

function Hero() {
  const ref = useGsapEffect((container) => {
    const cleanups = [heroLineReveal(container), parallax(container.querySelector('.hero-visual') ?? container, 34)];
    return () => cleanups.forEach((fn) => fn?.());
  }, []);

  return (
    <section className="hero-stage" ref={ref}>
      <div className="shell__main hero-grid">
        <div className="hero-copy">
          <span className="section-eyebrow" data-hero-fade>
            On-chain name registry for AI agents
          </span>

          <h1 className="hero-title">
            <span className="hero-line" data-line>
              <span>Every agent deserves</span>
            </span>
            <span className="hero-line" data-line>
              <span>
                a <span className="hero-lime">verifiable</span> name
              </span>
            </span>
          </h1>

          <p className="hero-lede" data-hero-fade>
            AgentNS binds a human-readable identity —{' '}
            <span className="mono">mcp://sentiment.text-analysis.acme.v1.0</span> — to an
            on-chain account, so clients can resolve who an agent is, who owns it, and what it
            stakes, without trusting an off-chain directory.
          </p>

          <div className="hero-cta" data-hero-fade>
            <Link to="/register" className="btn btn--primary btn--lg">
              Register an agent
            </Link>
            <Link to="/overview" className="btn btn--secondary btn--lg">
              Explore the protocol
            </Link>
          </div>

          <dl className="hero-proof" data-hero-fade>
            <div className="hero-proof__item">
              <dd className="hero-proof__value">a2a · mcp · acp</dd>
              <dt className="hero-proof__label">Protocols</dt>
            </div>
            <div className="hero-proof__item">
              <dd className="hero-proof__value">SHA-256</dd>
              <dt className="hero-proof__label">Identity basis</dt>
            </div>
            <div className="hero-proof__item">
              <dd className="hero-proof__value">1 : 1</dd>
              <dt className="hero-proof__label">Name to record</dt>
            </div>
          </dl>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <TradingMock />
        </div>
      </div>
    </section>
  );
}

/**
 * A composed product preview. It shows the *shape* of the registration flow —
 * a name input, a derived identifier, a stake and a cost — using representative
 * values, so it is labelled as a preview rather than presented as live data.
 */
function TradingMock() {
  return (
    <div className="mock">
      <div className="mock__bar">
        <span className="mock__dot" />
        <span className="mock__dot" />
        <span className="mock__dot" />
        <span className="mock__url">agentns.app/register</span>
      </div>
      <div className="mock__body">
        <div>
          <p className="mock__label">Agent name</p>
          <div className="mock__row">
            <span className="mock__token">
              <span className="mock__coin" style={{ background: 'var(--color-primary)' }}>
                M
              </span>
              MCP
            </span>
            <span className="mock__amount">1.0</span>
          </div>
          <div className="mock__swap" aria-hidden="true">
            ↓
          </div>
          <div className="mock__row">
            <span className="mock__token">sentiment</span>
            <span className="mock__amount">.text-analysis</span>
          </div>
          <div className="mock__quote">
            <span>Derived PDA</span>
            <b>8Fk2…vQd</b>
          </div>
          <div className="mock__quote">
            <span>Registration fee</span>
            <b>0.0100 SOL</b>
          </div>
          <div className="mock__quote">
            <span>Minimum stake</span>
            <b>0.1000 SOL</b>
          </div>
          <div className="mock__cta">Register name</div>
        </div>

        <div>
          <p className="mock__label">Agent mesh</p>
          <AgentNetwork />
          <div className="mock__spark" aria-hidden="true">
            {[38, 62, 45, 78, 55, 88, 66, 94, 72, 84].map((h, i) => (
              <span key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
      <p className="mock__footnote">Interface preview · values shown are illustrative</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Marquee */

const MARQUEE_ITEMS = [
  { text: 'REGISTER', accent: true },
  { text: 'RESOLVE' },
  { text: 'STAKE' },
  { text: 'VERIFY' },
  { text: 'TRANSFER' },
  { text: 'REVOKE' },
  { text: 'BUILT ONCHAIN' },
];

function Marquee() {
  const ref = useGsapEffect((container) => marqueeLoop(container, 34), []);

  const group = (
    <div className="marquee__group" aria-hidden="true">
      {MARQUEE_ITEMS.map((item) => (
        <span
          key={item.text}
          className={item.accent ? 'marquee__item marquee__item--accent' : 'marquee__item'}
        >
          {item.text}
          <span className="marquee__dot" />
        </span>
      ))}
    </div>
  );

  return (
    <section className="marquee" aria-label="AgentNS capabilities">
      <div className="marquee__track" ref={ref}>
        {/* Two identical copies translated by exactly -50% = seamless loop. */}
        {group}
        {group}
      </div>
      {/* Static fallback for reduced motion and for no-JS: real text, readable. */}
      <p className="sr-only">
        AgentNS lets agents register, resolve, stake, verify, transfer and revoke names on chain.
      </p>
    </section>
  );
}

/* ----------------------------------------------------------------- Protocol */

function Protocol() {
  const ref = useGsapEffect((container) => revealOnScroll(container, { stagger: 0.1 }), []);

  const capabilities = [
    {
      index: '01',
      title: 'Names that cannot collide',
      body: 'The full name is hashed with SHA-256 and that hash becomes the PDA seed for ["agent", hash]. One name can only ever map to one account, so an agent cannot be registered twice under the same identity.',
      mono: 'mcp://sentiment.text-analysis.acme.v1.0',
    },
    {
      index: '02',
      title: 'Ownership the program enforces',
      body: 'Registering, updating an endpoint, transferring and revoking all re-check that the signer is the recorded owner. The UI can only ever propose an action — the account constraints decide whether it happens.',
      mono: 'has_one = owner @ AgentNsError::NotOwner',
    },
    {
      index: '03',
      title: 'Stake that means something',
      body: 'Registration locks a minimum stake into the record account itself, not into an off-chain balance sheet. A challenge that fails takes a configured share of it, so agents have something at risk.',
      mono: 'min_stake_lamports · slash_bps',
    },
    {
      index: '04',
      title: 'Revocation that holds',
      body: 'Revoking keeps the account rather than deleting it, so the name stays reserved permanently. Nobody can register it afterwards to impersonate the agent that previously held it.',
      mono: 'status: Active → Revoked',
    },
  ];

  return (
    <section className="home-section" ref={ref}>
      <div className="shell__main">
        <div className="editorial">
          <div data-reveal>
            <span className="section-eyebrow">The protocol</span>
            <h2 className="section-title">A name is only as good as the rules behind it</h2>
            <p className="section-lede">
              AgentNS is deliberately narrow. It does one thing — give an AI agent a resolvable,
              owned identity — and puts the enforcement in the program rather than in a service
              that could change its mind tomorrow.
            </p>
          </div>

          <div className="capability">
            {capabilities.map((capability) => (
              <article className="capability__row" key={capability.index} data-reveal>
                <span className="capability__index">{capability.index}</span>
                <div>
                  <h3 className="capability__title">{capability.title}</h3>
                  <p className="capability__body">{capability.body}</p>
                  <p className="capability__mono">{capability.mono}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Showcase */

function Showcase() {
  const ref = useGsapEffect((container) => revealOnScroll(container, { stagger: 0.12 }), []);

  return (
    <section className="home-section home-section--alt" ref={ref}>
      <div className="shell__main">
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }} data-reveal>
          <span className="section-eyebrow">Product</span>
          <h2 className="section-title" style={{ maxInlineSize: 'none' }}>
            The whole lifecycle, in one place
          </h2>
        </div>

        <div className="showcase" data-reveal>
          <AgentLifecycle />
          <p className="showcase__caption">
            Every screen reads directly from the program — registry parameters, your records and
            transaction history are all live reads. Nothing on these pages is a mock.
          </p>
        </div>
      </div>
    </section>
  );
}

const LIFECYCLE = [
  {
    step: 'Register',
    path: '/register',
    body: 'Compose the five name parts and watch the hash and record address resolve live before you sign.',
  },
  {
    step: 'Manage',
    path: '/names',
    body: 'Every name you own, with its stake, verification state and last update, filtered to your wallet.',
  },
  {
    step: 'Watch',
    path: '/activity',
    body: 'Program-wide transaction history straight from the RPC node, each row linking to the explorer.',
  },
];

/** A condensed, honest preview of the three real product surfaces. */
function AgentLifecycle() {
  return (
    <div className="lifecycle">
      {LIFECYCLE.map((item) => (
        <Link key={item.step} to={item.path} className="lifecycle__card">
          <span className="lifecycle__step">{item.step}</span>
          <span className="lifecycle__body">{item.body}</span>
          <span className="lifecycle__go" aria-hidden="true">
            →
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Final CTA */

function FinalCta() {
  const ref = useGsapEffect((container) => revealOnScroll(container, { stagger: 0.08 }), []);

  return (
    <section className="home-section" ref={ref}>
      <div className="shell__main">
        <div className="final-cta" data-reveal>
          <h2 className="final-cta__title" data-reveal>
            Give your agent a name today
          </h2>
          <p className="final-cta__body" data-reveal>
            Registration is one transaction: a registration fee to the treasury and a minimum stake
            locked into the record. No off-chain account, no approval queue.
          </p>
          <div className="final-cta__actions" data-reveal>
            <Link to="/register" className="btn btn--primary btn--lg">
              Register an agent
            </Link>
            <Link to="/overview" className="btn btn--secondary btn--lg">
              View registry parameters
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export { Button };