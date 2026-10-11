import { Link } from "react-router-dom";

import { PageHeader } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { CopyButton } from "../components/ui/CopyButton";
import { Alert, Badge, EmptyState, Skeleton } from "../components/ui/Feedback";
import { explorerTxUrl } from "../config";
import { formatRelative, shortenAddress } from "../lib/format";
import { useRecentTransactions } from "../state/queries";

/**
 * Recent transactions touching the AgentNS program.
 *
 * Read straight from `getSignaturesForAddress`, so this is a real explorer-style
 * history. Status is shown as a word as well as a colour.
 */
export function ActivityPage() {
  const { data, isLoading, error, mutate, isValidating } =
    useRecentTransactions(25);

  return (
    <>
      <PageHeader
        eyebrow="Activity"
        title="Program activity"
        lede="Every transaction that touched the AgentNS program, newest first. Fetched from the RPC node — this is chain history, not a local log."
        actions={
          <Button
            variant="secondary"
            size="md"
            onClick={() => void mutate()}
            loading={isValidating && !isLoading}
          >
            Refresh
          </Button>
        }
      />

      {error ? (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <Alert tone="danger" title="Could not load activity">
            {error instanceof Error ? error.message : String(error)}
          </Alert>
        </div>
      ) : null}

      <Card flush>
        {isLoading ? (
          <div
            style={{
              padding: "var(--space-6)",
              display: "grid",
              gap: "var(--space-4)",
            }}
          >
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} height={44} />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState icon="◷" title="No transactions yet">
            Once someone registers, updates, transfers or revokes a name, the
            transaction will show up here with a link to the block explorer.
          </EmptyState>
        ) : (
          <div>
            {data.map((tx) => (
              <div key={tx.signature} className="tx-row">
                <Badge tone={tx.status === "success" ? "success" : "danger"}>
                  {tx.status === "success" ? "Success" : "Failed"}
                </Badge>

                <div style={{ minWidth: 0 }}>
                  <a
                    className="tx-row__sig"
                    href={explorerTxUrl(tx.signature)}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {shortenAddress(tx.signature, 8, 8)}
                  </a>
                  <div className="tx-row__meta">
                    Slot {tx.slot.toString()}
                    {" · "}
                    {tx.timestamp === null
                      ? "Time unavailable"
                      : formatRelative(tx.timestamp)}
                    {tx.status === "failed"
                      ? " · the transaction was reverted"
                      : ""}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  <CopyButton
                    value={tx.signature}
                    label="Copy signature"
                    size={12}
                  />
                  <a
                    className="inline-link"
                    href={explorerTxUrl(tx.signature)}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`Open ${shortenAddress(tx.signature, 8, 8)} in the block explorer`}
                  >
                    View
                    <span className="sr-only">
                      {" "}
                      transaction in the block explorer
                    </span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {!data || data.length === 0 ? (
        <div style={{ marginTop: "var(--space-6)" }}>
          <p className="field__hint">
            Looking for a specific record?{" "}
            <Link to="/names">Browse the names you own.</Link>
          </p>
        </div>
      ) : null}
    </>
  );
}
