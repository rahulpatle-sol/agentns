import { Link } from "react-router-dom";

import {
  Card,
  CardBody,
  CardHeader,
  Stat,
  StatGrid,
} from "../components/ui/Card";
import { CopyButton } from "../components/ui/CopyButton";
import { Alert, Badge, Skeleton } from "../components/ui/Feedback";
import { agentnsProgramId, explorerAddressUrl } from "../config";
import {
  formatBps,
  formatDuration,
  formatSol,
  shortenAddress,
} from "../lib/format";
import { PROTOCOL_LABEL } from "../program/constants";
import { useRegistryConfig } from "../state/queries";
import { useWallet } from "../state/wallet";

/**
 * Registry dashboard.
 *
 * Every figure on this page is read from the on-chain `RegistryConfig` account.
 * When the account does not exist the page says so instead of showing zeros or
 * placeholder values, because "0 SOL fee" would be a lie.
 */
export function OverviewPage() {
  const { config, configAddress, isLoading, error } = useRegistryConfig();
  const wallet = useWallet();

  return (
    <>
      <section className="hero">
        <span className="hero__eyebrow">On-chain agent registry</span>
        <h1 className="hero__title">Give every agent a verifiable name.</h1>
        <p className="hero__body">
          AgentNS stores an immutable{" "}
          <span className="mono">protocol://id.capability.provider.vX</span>{" "}
          name for each AI agent, alongside its endpoint, owner and stake. Names
          are resolved from the SHA-256 of that string, so one agent can never
          be registered twice.
        </p>
        <div className="hero__actions">
          <Link to="/register" className="btn btn--secondary btn--lg">
            Register an agent
          </Link>
          <Link to="/names" className="btn btn--secondary btn--lg">
            View my names
          </Link>
        </div>
      </section>

      <div className="section">
        <div className="section__header">
          <h2 className="section__title">Registry parameters</h2>
          {configAddress ? (
            <span
              className="inline-link mono"
              style={{ fontSize: "var(--text-xs)" }}
            >
              {shortenAddress(configAddress)}
              <CopyButton
                value={configAddress}
                label="Copy config address"
                size={12}
              />
            </span>
          ) : null}
        </div>

        {error ? (
          <Alert tone="danger" title="Cannot read the registry">
            {error.message}
          </Alert>
        ) : isLoading ? (
          <div className="stat-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <Card key={index}>
                <CardBody>
                  <Skeleton height={10} width="45%" />
                  <div style={{ height: 10 }} />
                  <Skeleton height={26} width="65%" />
                </CardBody>
              </Card>
            ))}
          </div>
        ) : !config ? (
          <Alert tone="warning" title="Registry not initialised">
            The AgentNS program is deployed but its{" "}
            <span className="mono">RegistryConfig</span> account does not exist
            yet. Registration stays locked until an admin calls{" "}
            <span className="mono">initialize_config</span>. No parameters are
            shown because none exist on chain yet.
          </Alert>
        ) : (
          <Card>
            <CardBody>
              <StatGrid>
                <Stat
                  label="Registration fee"
                  value={formatSol(config.registrationFeeLamports)}
                  hint="Paid to the treasury on register"
                />
                <Stat
                  label="Minimum stake"
                  value={formatSol(config.minStakeLamports)}
                  hint="Locked in the agent record"
                />
                <Stat
                  label="Slash on failed challenge"
                  value={formatBps(config.slashBps)}
                  hint="Share of stake a verifier can take"
                />
                <Stat
                  label="Unstake cooldown"
                  value={formatDuration(config.unstakeCooldownSecs)}
                  hint="Wait after requesting an unstake"
                />
              </StatGrid>

              <div
                style={{
                  marginTop: "var(--space-6)",
                  paddingTop: "var(--space-6)",
                  borderTop: "1px solid var(--color-border)",
                }}
              >
                <StatGrid>
                  <Stat
                    label="Marketplace fee"
                    value={formatBps(config.marketplaceFeeBps)}
                    size="sm"
                    hint="Phase 3 · reserved"
                  />
                  <Stat
                    label="Verifiers"
                    value={config.verifiers.length}
                    size="sm"
                    hint={
                      config.verifiers.length === 0
                        ? "No verifiers set"
                        : "Wallets allowed to report challenges"
                    }
                  />
                  <div className="stat">
                    <span className="stat__label">Treasury</span>
                    <span className="inline-link mono" style={{ marginTop: 4 }}>
                      {shortenAddress(config.treasury)}
                      <CopyButton
                        value={config.treasury}
                        label="Copy treasury address"
                        size={12}
                      />
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat__label">Resolver key</span>
                    <span className="inline-link mono" style={{ marginTop: 4 }}>
                      {shortenAddress(config.resolverPubkey)}
                      <CopyButton
                        value={config.resolverPubkey}
                        label="Copy resolver key"
                        size={12}
                      />
                    </span>
                  </div>
                </StatGrid>
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      <div className="section">
        <Card>
          <CardHeader
            title="How a name is built"
            subtitle="The program re-computes this string and re-hashes it on chain, so a tampered client cannot register a different name."
          />
          <CardBody>
            <div className="kv">
              <span className="kv__key">Shape</span>
              <span className="kv__value mono">
                protocol://agent-id.capability.provider.vVERSION
              </span>
              <span className="kv__key">Protocols</span>
              <span className="kv__value">
                {(["a2a", "mcp", "acp"] as const).map((protocol) => (
                  <Badge key={protocol} tone="success">
                    {PROTOCOL_LABEL[protocol]}
                  </Badge>
                ))}
              </span>
              <span className="kv__key">Identity</span>
              <span className="kv__value">
                SHA-256 of the full name becomes the PDA seed{" "}
                <span className="mono">["agent", hash]</span>, which is what
                guarantees one record per name.
              </span>
              <span className="kv__key">Revocation</span>
              <span className="kv__value">
                Revoked names keep their account, so the name stays reserved and
                nobody can register it to impersonate the original agent.
              </span>
              <span className="kv__key">Program</span>
              <span className="kv__value mono">
                {shortenAddress(agentnsProgramId, 6, 6)}{" "}
                <a
                  href={explorerAddressUrl(agentnsProgramId)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  View on explorer
                </a>
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {!wallet.isConnected ? (
        <div className="section">
          <Alert
            tone="info"
            title="Connect a wallet to register or manage names"
          >
            Browsing works without a wallet. Registering, updating, transferring
            and revoking all require a connected wallet to sign.
          </Alert>
        </div>
      ) : null}
    </>
  );
}
