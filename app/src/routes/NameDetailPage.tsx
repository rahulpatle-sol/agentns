import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { address, type Address } from "@solana/kit";

import { PageHeader } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { Card, CardBody, Stat, StatGrid } from "../components/ui/Card";
import { CopyButton } from "../components/ui/CopyButton";
import { ConfirmDialog, Dialog } from "../components/ui/Dialog";
import { Alert, Skeleton } from "../components/ui/Feedback";
import { Field, Input } from "../components/ui/Form";
import { explorerTxUrl } from "../config";
import {
  bytesToHex,
  formatSol,
  formatTimestamp,
  shortenAddress,
} from "../lib/format";
import { PROTOCOL_LABEL } from "../program/constants";
import {
  getRevokeNameInstruction,
  getTransferNameInstruction,
  getUpdateEndpointInstruction,
} from "../program/agentns";
import { looksLikeAddress, validateEndpoint } from "../program/validation";
import { useAgentRecord } from "../state/queries";
import { useTransaction } from "../state/transactions/useTransaction";
import { useWallet } from "../state/wallet";

/** Detail view for one agent record, plus its owner-only management actions. */
export function NameDetailPage() {
  const { pda } = useParams<{ pda: string }>();
  const wallet = useWallet();

  const recordAddress = useMemo(
    () => (pda && looksLikeAddress(pda) ? (pda as Address) : null),
    [pda],
  );
  const {
    data: record,
    isLoading,
    error,
    mutate,
  } = useAgentRecord(recordAddress);

  const [endpointOpen, setEndpointOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const isOwner = Boolean(record && wallet.address === record.owner);

  if (!pda || !recordAddress) {
    return (
      <>
        <PageHeader eyebrow="Agent record" title="Invalid record address" />
        <Alert tone="danger" title="That is not a valid Solana address">
          A record address looks like <span className="mono">4C7v…9xQd</span>.
          Check the link and try again.
        </Alert>
        <div style={{ marginTop: "var(--space-6)" }}>
          <Link to="/names" className="btn btn--secondary btn--md">
            Back to my names
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={record ? PROTOCOL_LABEL[record.protocol] : "Agent record"}
        title={record ? record.name : "Agent record"}
        lede={
          record
            ? "Decoded from the on-chain account. Actions below are owner-only and each one signs a separate transaction."
            : undefined
        }
        actions={
          <Link to="/names" className="btn btn--ghost btn--md">
            ← Back
          </Link>
        }
      />

      {error ? (
        <Alert tone="danger" title="Could not read this record">
          {error instanceof Error ? error.message : String(error)}
        </Alert>
      ) : isLoading ? (
        <Card>
          <CardBody>
            <Skeleton height={22} width="55%" />
            <div style={{ height: 16 }} />
            <Skeleton height={14} width="85%" />
          </CardBody>
        </Card>
      ) : !record ? (
        <Alert tone="warning" title="No record at this address">
          Nothing is stored at{" "}
          <span className="mono">{shortenAddress(recordAddress, 8, 8)}</span>.
          Either this name was never registered, or the address was derived with
          a different program or a different name.
        </Alert>
      ) : (
        <>
          <Card>
            <CardBody>
              <StatGrid>
                <Stat
                  label="Stake"
                  value={formatSol(record.stakeLamports)}
                  hint="Locked in this account"
                />
                <Stat
                  label="Challenge record"
                  value={`${record.passes} / ${record.fails}`}
                  hint="Verifier passes vs fails"
                />
                <Stat
                  label="Endpoint"
                  value={record.endpointVerified ? "Verified" : "Unverified"}
                  tone={record.endpointVerified ? "positive" : "muted"}
                  size="sm"
                />
                <Stat
                  label="Status"
                  value={record.status === "active" ? "Active" : "Revoked"}
                  tone={record.status === "active" ? "positive" : "muted"}
                  size="sm"
                />
              </StatGrid>
            </CardBody>
          </Card>

          {record.status === "revoked" ? (
            <div style={{ marginTop: "var(--space-6)" }}>
              <Alert tone="warning" title="This name is revoked">
                The account is kept on purpose so the name stays reserved and no
                one else can register it to impersonate the original agent. It
                can no longer be updated, transferred or re-activated.
              </Alert>
            </div>
          ) : null}

          <div className="section">
            <div className="section__header">
              <h2 className="section__title">On-chain fields</h2>
            </div>
            <Card>
              <CardBody>
                <div className="kv">
                  <span className="kv__key">Record address</span>
                  <span className="kv__value mono">
                    {recordAddress}{" "}
                    <CopyButton
                      value={recordAddress}
                      label="Copy record address"
                      size={12}
                    />
                  </span>

                  <span className="kv__key">Owner</span>
                  <span className="kv__value mono">
                    {record.owner}{" "}
                    <CopyButton
                      value={record.owner}
                      label="Copy owner address"
                      size={12}
                    />
                  </span>

                  <span className="kv__key">Endpoint</span>
                  <span className="kv__value mono">
                    {record.endpoint ? (
                      <a
                        href={record.endpoint}
                        target="_blank"
                        rel="noreferrer noopener"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {record.endpoint}
                      </a>
                    ) : (
                      "—"
                    )}
                  </span>

                  <span className="kv__key">Agent public key</span>
                  <span className="kv__value mono">{record.agentPubkey}</span>

                  <span className="kv__key">Metadata URI</span>
                  <span className="kv__value mono">
                    {record.metadataUri || (
                      <span style={{ color: "var(--color-muted)" }}>None</span>
                    )}
                  </span>

                  <span className="kv__key">Name hash</span>
                  <span
                    className="kv__value mono"
                    style={{ fontSize: "var(--text-xs)" }}
                  >
                    {bytesToHex(record.nameHash)}
                  </span>

                  <span className="kv__key">Registered</span>
                  <span className="kv__value">
                    {formatTimestamp(record.registeredAt)}
                  </span>

                  <span className="kv__key">Last updated</span>
                  <span className="kv__value">
                    {formatTimestamp(record.updatedAt)}
                  </span>

                  {record.unstakeRequestedAt > 0n ? (
                    <>
                      <span className="kv__key">Unstake requested</span>
                      <span className="kv__value">
                        {formatTimestamp(record.unstakeRequestedAt)}
                      </span>
                    </>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="section">
            <div className="section__header">
              <h2 className="section__title">Manage</h2>
              {!isOwner && wallet.isConnected ? (
                <span className="field__hint">
                  Read-only: the connected wallet is not the owner of this name.
                </span>
              ) : null}
            </div>

            {!wallet.isConnected ? (
              <Alert
                tone="info"
                title="Connect the owning wallet to make changes"
              >
                Updating, transferring and revoking all require the owner wallet
                to sign.
              </Alert>
            ) : !isOwner ? (
              <Alert tone="info">
                The connected wallet is not the owner of this name, so these
                actions are unavailable.
              </Alert>
            ) : record.status === "revoked" ? (
              <Alert tone="warning">
                Revoked names are read-only. The program rejects every owner
                action on them.
              </Alert>
            ) : (
              <Card>
                <CardBody>
                  <div
                    style={{
                      display: "flex",
                      gap: "var(--space-3)",
                      flexWrap: "wrap",
                    }}
                  >
                    <Button
                      variant="primary"
                      onClick={() => setEndpointOpen(true)}
                    >
                      Update endpoint
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setTransferOpen(true)}
                    >
                      Transfer name
                    </Button>
                    <Button
                      variant="danger-ghost"
                      onClick={() => setRevokeOpen(true)}
                    >
                      Revoke name
                    </Button>
                  </div>
                  <p
                    className="field__hint"
                    style={{ marginTop: "var(--space-4)" }}
                  >
                    Revoking permanently marks the name unusable and keeps the
                    account so the name cannot be claimed by anyone else.
                  </p>
                </CardBody>
              </Card>
            )}
          </div>

          <UpdateEndpointDialog
            open={endpointOpen}
            onClose={() => setEndpointOpen(false)}
            pda={recordAddress}
            owner={wallet.address}
            currentEndpoint={record.endpoint}
            currentAgentPubkey={record.agentPubkey}
            currentMetadataUri={record.metadataUri}
            onDone={() => void mutate()}
          />
          <TransferDialog
            open={transferOpen}
            onClose={() => setTransferOpen(false)}
            pda={recordAddress}
            owner={wallet.address}
            currentOwner={record.owner}
            onDone={() => void mutate()}
          />
          <RevokeDialog
            open={revokeOpen}
            onClose={() => setRevokeOpen(false)}
            pda={recordAddress}
            owner={wallet.address}
            name={record.name}
            onDone={() => void mutate()}
          />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Dialogs */

function UpdateEndpointDialog({
  open,
  onClose,
  pda,
  owner,
  currentEndpoint,
  currentAgentPubkey,
  currentMetadataUri,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  pda: Address;
  owner: Address | null;
  currentEndpoint: string;
  currentAgentPubkey: string;
  currentMetadataUri: string;
  onDone: () => void;
}) {
  const tx = useTransaction();
  const [endpoint, setEndpoint] = useState(currentEndpoint);
  const [agentPubkey, setAgentPubkey] = useState(currentAgentPubkey);
  const [metadataUri, setMetadataUri] = useState(currentMetadataUri);

  const endpointCheck = validateEndpoint(endpoint);
  const pubkeyInvalid =
    agentPubkey.length > 0 && !looksLikeAddress(agentPubkey);
  const unchanged =
    endpoint === currentEndpoint &&
    agentPubkey === currentAgentPubkey &&
    metadataUri === currentMetadataUri;

  const disabledReason = !owner
    ? "Connect the owning wallet."
    : !endpointCheck.ok
      ? endpointCheck.message
      : pubkeyInvalid
        ? "Agent public key is not a valid Solana address."
        : unchanged
          ? "Nothing has changed yet."
          : null;

  const onConfirm = async () => {
    if (!owner || disabledReason) return;
    const instruction = await getUpdateEndpointInstruction(
      {
        endpoint,
        agentPubkey: address(agentPubkey || owner),
        metadataUri,
      },
      { owner, agentRecord: pda },
    );
    const signature = await tx.send(instruction, {
      pendingTitle: "Updating endpoint",
      successTitle: "Endpoint updated",
      action: "Updating this endpoint",
      onConfirmed: onDone,
    });
    if (signature) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Update endpoint"
      footer={
        <>
          <button
            type="button"
            className="btn btn--secondary btn--md"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--md"
            onClick={onConfirm}
            disabled={tx.isBusy || Boolean(disabledReason)}
          >
            {tx.isBusy ? "Confirming…" : "Save endpoint"}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: "var(--space-5)" }}>
        <Field
          label="Endpoint"
          required
          error={!endpointCheck.ok ? endpointCheck.message : undefined}
          hint="Must start with https://"
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={endpoint}
              onChange={(event) => setEndpoint(event.target.value)}
              className="input--mono"
              autoComplete="off"
            />
          )}
        </Field>
        <Field
          label="Agent public key"
          error={pubkeyInvalid ? "Not a valid Solana address." : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={agentPubkey}
              onChange={(event) => setAgentPubkey(event.target.value)}
              className="input--mono"
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Metadata URI" hint="Optional.">
          {({ id }) => (
            <Input
              id={id}
              value={metadataUri}
              onChange={(event) => setMetadataUri(event.target.value)}
              className="input--mono"
              autoComplete="off"
            />
          )}
        </Field>
        {tx.state.error ? (
          <Alert
            tone={tx.state.error.isUserRejection ? "info" : "danger"}
            title={tx.state.error.title}
          >
            {tx.state.error.message}
            {tx.state.signature ? (
              <>
                {" "}
                <a
                  href={explorerTxUrl(tx.state.signature)}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  View transaction
                </a>
              </>
            ) : null}
          </Alert>
        ) : null}
      </div>
    </Dialog>
  );
}

function TransferDialog({
  open,
  onClose,
  pda,
  owner,
  currentOwner,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  pda: Address;
  owner: Address | null;
  currentOwner: string;
  onDone: () => void;
}) {
  const tx = useTransaction();
  const [newOwner, setNewOwner] = useState("");

  const invalid = newOwner.length > 0 && !looksLikeAddress(newOwner);
  const sameAsCurrent = newOwner.length > 0 && newOwner === currentOwner;
  const disabledReason = !owner
    ? "Connect the owning wallet."
    : !newOwner
      ? "Enter the destination wallet."
      : invalid
        ? "That is not a valid Solana address."
        : sameAsCurrent
          ? "The new owner must be a different wallet."
          : null;

  const onConfirm = async () => {
    if (!owner || disabledReason) return;
    const instruction = await getTransferNameInstruction(address(newOwner), {
      owner,
      agentRecord: pda,
    });
    const signature = await tx.send(instruction, {
      pendingTitle: "Transferring name",
      successTitle: "Name transferred",
      action: "Transferring this name",
      onConfirmed: onDone,
    });
    if (signature) {
      setNewOwner("");
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Transfer name"
      footer={
        <>
          <button
            type="button"
            className="btn btn--secondary btn--md"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--md"
            onClick={onConfirm}
            disabled={tx.isBusy || Boolean(disabledReason)}
          >
            {tx.isBusy ? "Confirming…" : "Transfer name"}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gap: "var(--space-5)" }}>
        <Alert tone="warning" title="Ownership moves immediately">
          The new owner can update, transfer or revoke this name as soon as the
          transaction confirms. The stake stays locked in the record.
        </Alert>
        <Field
          label="New owner address"
          required
          error={invalid ? "That is not a valid Solana address." : undefined}
        >
          {({ id, describedBy, invalid: ariaInvalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={ariaInvalid || undefined}
              value={newOwner}
              onChange={(event) => setNewOwner(event.target.value)}
              placeholder="Base58 address"
              className="input--mono"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>
        {tx.state.error ? (
          <Alert
            tone={tx.state.error.isUserRejection ? "info" : "danger"}
            title={tx.state.error.title}
          >
            {tx.state.error.message}
          </Alert>
        ) : null}
      </div>
    </Dialog>
  );
}

function RevokeDialog({
  open,
  onClose,
  pda,
  owner,
  name,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  pda: Address;
  owner: Address | null;
  name: string;
  onDone: () => void;
}) {
  const tx = useTransaction();

  const onConfirm = async () => {
    if (!owner) return;
    const instruction = await getRevokeNameInstruction({
      owner,
      agentRecord: pda,
    });
    const signature = await tx.send(instruction, {
      pendingTitle: `Revoking ${name}`,
      successTitle: `${name} revoked`,
      action: "Revoking this name",
      onConfirmed: onDone,
    });
    if (signature) onClose();
  };

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Revoke this name?"
      confirmLabel="Revoke name"
      loading={tx.isBusy}
      disabledReason={owner ? undefined : "Connect the owning wallet."}
    >
      <p>
        <span className="mono">{name}</span> will be marked revoked and can
        never be updated, transferred or registered by anyone else again.
      </p>
      <p style={{ marginTop: "var(--space-3)" }}>
        The account is kept on purpose so the name stays reserved and cannot be
        used to impersonate this agent. The stake is not returned by this
        transaction.
      </p>
      {tx.state.error ? (
        <div style={{ marginTop: "var(--space-4)" }}>
          <Alert
            tone={tx.state.error.isUserRejection ? "info" : "danger"}
            title={tx.state.error.title}
          >
            {tx.state.error.message}
          </Alert>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
