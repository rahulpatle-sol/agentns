import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { AddressChip } from "../components/ui/CopyButton";
import { Alert, Badge, EmptyState, Skeleton } from "../components/ui/Feedback";
import { Segmented } from "../components/ui/Tabs";
import { formatRelative, formatSol, shortenAddress } from "../lib/format";
import { PROTOCOL_LABEL } from "../program/constants";
import { useRecordsByOwner } from "../state/queries";
import { useWallet } from "../state/wallet";

type Filter = "all" | "active" | "revoked";

/** Every agent record owned by the connected wallet. */
export function MyNamesPage() {
  const wallet = useWallet();
  const { data, isLoading, error, mutate } = useRecordsByOwner(wallet.address);
  const [filter, setFilter] = useState<Filter>("all");

  const records = useMemo(() => {
    const all = data ?? [];
    if (filter === "all") return all;
    return all.filter((record) => record.status === filter);
  }, [data, filter]);

  if (!wallet.isConnected) {
    return (
      <>
        <PageHeader
          eyebrow="My names"
          title="Your registered agents"
          lede="Records are fetched straight from chain with a memcmp filter on the owner field, so this list only ever contains names you own."
        />
        <Card>
          <EmptyState
            icon="◎"
            title="No wallet connected"
            action={
              <Link to="/" className="btn btn--primary btn--md">
                Go to overview
              </Link>
            }
          >
            Connect a wallet from the header to see the agent names it owns.
            Browsing the registry does not require a connection, but listing
            your own records does.
          </EmptyState>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="My names"
        title="Your registered agents"
        lede="Each row is one on-chain agent record owned by the connected wallet."
        actions={
          <Link to="/register" className="btn btn--primary btn--md">
            Register another
          </Link>
        }
      />

      {error ? (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <Alert tone="danger" title="Could not load your names">
            {error instanceof Error ? error.message : String(error)}
          </Alert>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          marginBottom: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <Segmented
          label="Filter by status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "revoked", label: "Revoked" },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => void mutate()}>
          Refresh
        </Button>
      </div>

      <Card flush>
        {isLoading ? (
          <div
            style={{
              padding: "var(--space-6)",
              display: "grid",
              gap: "var(--space-4)",
            }}
          >
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} height={56} />
            ))}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon="◇"
            title={
              (data?.length ?? 0) === 0
                ? "No agent names yet"
                : `No ${filter} names`
            }
            action={
              (data?.length ?? 0) === 0 ? (
                <Link to="/register" className="btn btn--primary btn--md">
                  Register your first agent
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setFilter("all")}
                >
                  Show all names
                </Button>
              )
            }
          >
            {(data?.length ?? 0) === 0
              ? "Names you register will appear here, with their stake, endpoint and verification status."
              : "Try a different status filter to see the rest of your records."}
          </EmptyState>
        ) : (
          <div className="record-list">
            {records.map((record) => (
              <Link
                key={record.pda}
                to={`/names/${record.pda}`}
                className="record-row"
              >
                <div style={{ minWidth: 0 }}>
                  <div className="record-row__name">{record.name}</div>
                  <div className="record-row__meta">
                    <Badge tone="success">
                      {PROTOCOL_LABEL[record.protocol]}
                    </Badge>
                    <Badge
                      tone={record.status === "active" ? "success" : "danger"}
                    >
                      {record.status === "active" ? "Active" : "Revoked"}
                    </Badge>
                    {record.endpointVerified ? (
                      <Badge tone="lime">Endpoint verified</Badge>
                    ) : null}
                    <span>Stake {formatSol(record.stakeLamports)}</span>
                    <span>·</span>
                    <span>
                      Registered {formatRelative(record.registeredAt)}
                    </span>
                  </div>
                </div>
                <div className="record-row__side">
                  <AddressChip
                    value={record.pda}
                    shorten={(v) => shortenAddress(v)}
                    label="Record address"
                  />
                  <span className="record-row__chevron" aria-hidden="true">
                    ›
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
