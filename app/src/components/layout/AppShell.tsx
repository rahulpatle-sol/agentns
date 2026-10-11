import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

import {
  activeCluster,
  agentnsProgramId,
  explorerAddressUrl,
} from "../../config";
import { shortenAddress } from "../../lib/format";
import { NetworkBadge, WalletButton } from "../wallet/WalletButton";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/register", label: "Register", end: false },
  { to: "/names", label: "My names", end: false },
  { to: "/activity", label: "Activity", end: false },
] as const;

/** Header, primary navigation and page frame. */
export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer on navigation so it never covers the new page.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="header">
        <div className="header__inner">
          <NavLink to="/" className="brand" aria-label="AgentNS home">
            <span className="brand__mark" aria-hidden="true">
              AN
            </span>
            <span>
              <span className="brand__name">AgentNS</span>
              <span className="brand__tag">Agent Name Registry</span>
            </span>
          </NavLink>

          <nav
            className="nav"
            id="primary-navigation"
            aria-label="Primary"
            hidden={!navOpen}
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? "nav__link is-active" : "nav__link"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="header__actions">
            <NetworkBadge />
            <WalletButton />
            <button
              type="button"
              className="nav-toggle"
              onClick={() => setNavOpen((open) => !open)}
              aria-expanded={navOpen}
              aria-controls="primary-navigation"
            >
              <span className="sr-only">
                {navOpen ? "Close navigation" : "Open navigation"}
              </span>
              <span aria-hidden="true">{navOpen ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="shell__main" id="main">
        {children}
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <span>
            AgentNS · on-chain names for AI agents ·{" "}
            <span className="mono">{shortenAddress(agentnsProgramId)}</span>
          </span>
          <span className="footer__links">
            <a
              href={explorerAddressUrl(agentnsProgramId)}
              target="_blank"
              rel="noreferrer noopener"
            >
              Program on explorer
            </a>
            <span className="mono" title="Active RPC endpoint">
              {activeCluster.rpcUrl.replace(/^https?:\/\//, "")}
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <h1 className="page-title">{title}</h1>
        {actions}
      </div>
      {lede ? <p className="page-lede">{lede}</p> : null}
    </div>
  );
}
