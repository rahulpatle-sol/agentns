import { useEffect, useMemo, useState } from "react";
import type { Address } from "@solana/kit";

import { PageHeader } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Stat,
} from "../components/ui/Card";
import { Alert, Badge, Chip } from "../components/ui/Feedback";
import { Field, Input, Select } from "../components/ui/Form";
import { activeCluster } from "../config";
import { bytesToHex, formatSol, parseSol, shortenAddress } from "../lib/format";
import { PROTOCOLS, buildName, type Protocol } from "../program/constants";
import {
  agentPdaForName,
  getRegisterNameInstruction,
  hashName,
} from "../program/agentns";
import {
  looksLikeAddress,
  validateEndpoint,
  validateMetadataUri,
  validatePart,
  validateVersion,
  type ValidationResult,
} from "../program/validation";
import { useRegistryConfig } from "../state/queries";
import { useTransaction } from "../state/transactions/useTransaction";
import { useWallet } from "../state/wallet";

type FormState = {
  protocol: Protocol;
  agentId: string;
  capability: string;
  provider: string;
  version: string;
  endpoint: string;
  agentPubkey: string;
  metadataUri: string;
  stakeSol: string;
};

const INITIAL_FORM: FormState = {
  protocol: "mcp",
  agentId: "",
  capability: "",
  provider: "",
  version: "1.0",
  endpoint: "",
  agentPubkey: "",
  metadataUri: "",
  stakeSol: "",
};

/**
 * Registration form.
 *
 * The name, its SHA-256 hash and the derived PDA are computed locally and shown
 * live, because the program derives the record account from exactly these bytes —
 * if the preview is wrong, the transaction would land on the wrong account. Costs
 * come from the on-chain config; when the config is unavailable the button stays
 * disabled rather than guessing a fee.
 */
export function RegisterPage() {
  const wallet = useWallet();
  const {
    config,
    configAddress,
    isLoading: configLoading,
    error: configError,
  } = useRegistryConfig();
  const tx = useTransaction();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [nameHash, setNameHash] = useState<string | null>(null);
  const [pda, setPda] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setTouched((current) => ({ ...current, [key]: true }));
  };

  const fullName = buildName(
    form.protocol,
    form.agentId,
    form.capability,
    form.provider,
    form.version,
  );

  // Recompute the hash and PDA whenever the name components change.
  useEffect(() => {
    const partsValid =
      validatePart("Agent ID", form.agentId).ok &&
      validatePart("Capability", form.capability).ok &&
      validatePart("Provider", form.provider).ok &&
      validateVersion(form.version).ok;

    if (!partsValid) {
      setNameHash(null);
      setPda(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const hash = await hashName(fullName);
      const derived = await agentPdaForName(fullName);
      if (cancelled) return;
      setNameHash(bytesToHex(hash));
      setPda(derived);
    })();

    return () => {
      cancelled = true;
    };
  }, [fullName, form.agentId, form.capability, form.provider, form.version]);

  const errors = useMemo(() => {
    return {
      agentId: validatePart("Agent ID", form.agentId),
      capability: validatePart("Capability", form.capability),
      provider: validatePart("Provider", form.provider),
      version: validateVersion(form.version),
      endpoint: validateEndpoint(form.endpoint),
      metadataUri: validateMetadataUri(form.metadataUri),
      agentPubkey:
        form.agentPubkey.length === 0 || looksLikeAddress(form.agentPubkey)
          ? { ok: true as const }
          : {
              ok: false as const,
              message: "That does not look like a Solana address.",
            },
    };
  }, [form]);

  const stakeLamports = parseSol(form.stakeSol) ?? 0n;
  const minStake = config?.minStakeLamports ?? 0n;
  const stakeBelowMinimum = Boolean(config) && stakeLamports < minStake;

  const stakeValid = parseSol(form.stakeSol) !== null;
  const hasFormError = Object.values(errors).some((result) => !result.ok);
  const formComplete =
    form.agentId.length > 0 &&
    form.capability.length > 0 &&
    form.provider.length > 0 &&
    form.endpoint.length > 0 &&
    Boolean(nameHash) &&
    Boolean(pda);

  const totalCost = (config?.registrationFeeLamports ?? 0n) + stakeLamports;

  const blockedReason = (() => {
    if (!wallet.isConnected) return "Connect a wallet to register a name.";
    if (configLoading) return "Reading registry config…";
    if (configError) return "Cannot reach the RPC endpoint.";
    if (!config)
      return "The registry is not initialised, so registration is unavailable.";
    if (hasFormError) return "Fix the highlighted fields to continue.";
    if (!formComplete) return "Fill in every required field.";
    if (!stakeValid) return "Enter a valid SOL amount for the stake.";
    if (stakeBelowMinimum) {
      return `Stake must be at least ${formatSol(minStake)}.`;
    }
    return null;
  })();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      blockedReason ||
      !config ||
      !configAddress ||
      !wallet.address ||
      !nameHash
    )
      return;

    const hashBytes = await hashName(fullName);
    const recordPda = await agentPdaForName(fullName);
    const stake = parseSol(form.stakeSol);
    if (stake === null) return;

    const instruction = await getRegisterNameInstruction(
      {
        nameHash: hashBytes,
        protocol: form.protocol,
        agentId: form.agentId,
        capability: form.capability,
        provider: form.provider,
        version: form.version,
        endpoint: form.endpoint,
        // An empty agent pubkey is allowed by the program; fall back to the
        // connected wallet so the record is still attributable.
        agentPubkey: (form.agentPubkey || wallet.address) as Address,
        metadataUri: form.metadataUri,
        stakeLamports: stake,
      },
      {
        owner: wallet.address,
        config: configAddress,
        treasury: config.treasury,
        agentRecord: recordPda,
      },
    );

    const signature = await tx.send(instruction, {
      pendingTitle: `Registering ${fullName}`,
      successTitle: `${fullName} registered`,
      action: "Registering this name",
      onConfirmed: () => setForm(INITIAL_FORM),
    });

    if (signature) setTouched({});
  };

  const errorText = (key: keyof FormState, result: ValidationResult) =>
    touched[key] && !result.ok ? result.message : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Register"
        title="Register an agent name"
        lede="The name is derived from five parts and hashed on chain. Check the preview before signing — the record account is created at the PDA shown here."
      />

      {!activeCluster.isTestnet ? (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <Alert tone="warning" title="You are on mainnet">
            This registration sends real SOL and cannot be undone. Revoking
            keeps the name reserved but does not return the stake.
          </Alert>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        <div className="workbench">
          <div style={{ display: "grid", gap: "var(--space-6)" }}>
            <Card>
              <CardHeader
                title="Name"
                subtitle="All three parts accept lowercase letters, digits and hyphens, 1–32 characters."
              />
              <CardBody>
                <div className="form-grid">
                  <Field label="Protocol" required>
                    {({ id }) => (
                      <Select
                        id={id}
                        value={form.protocol}
                        onChange={(event) =>
                          set("protocol", event.target.value as Protocol)
                        }
                        options={PROTOCOLS.map((protocol) => ({
                          value: protocol,
                          label: protocol.toUpperCase(),
                        }))}
                      />
                    )}
                  </Field>

                  <Field
                    label="Version"
                    required
                    error={errorText("version", errors.version)}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        value={form.version}
                        onChange={(event) => set("version", event.target.value)}
                        placeholder="1.0"
                        className="input--mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </Field>

                  <Field
                    label="Agent ID"
                    required
                    error={errorText("agentId", errors.agentId)}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        value={form.agentId}
                        onChange={(event) => set("agentId", event.target.value)}
                        placeholder="sentiment"
                        className="input--mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </Field>

                  <Field
                    label="Capability"
                    required
                    error={errorText("capability", errors.capability)}
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        value={form.capability}
                        onChange={(event) =>
                          set("capability", event.target.value)
                        }
                        placeholder="text-analysis"
                        className="input--mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </Field>

                  <Field
                    label="Provider"
                    required
                    error={errorText("provider", errors.provider)}
                    hint="Your organisation or namespace."
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        value={form.provider}
                        onChange={(event) =>
                          set("provider", event.target.value)
                        }
                        placeholder="acme"
                        className="input--mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </Field>

                  <div className="name-preview" aria-live="polite">
                    <span className="name-preview__label">Full name</span>
                    <p className="name-preview__value">
                      {nameHash ? (
                        fullName
                      ) : (
                        <span className="is-placeholder">
                          protocol://agent-id.capability.provider.vX
                        </span>
                      )}
                    </p>
                    <div style={{ marginTop: "var(--space-3)" }}>
                      <span className="name-preview__label">Record PDA</span>
                      <p className="name-preview__value">
                        {pda ? (
                          shortenAddress(pda, 6, 6)
                        ) : (
                          <span className="is-placeholder">—</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Agent details"
                subtitle="Where clients should reach this agent, and which key it signs with."
              />
              <CardBody>
                <div className="form-grid">
                  <div className="span-2">
                    <Field
                      label="Endpoint"
                      required
                      error={errorText("endpoint", errors.endpoint)}
                      hint="Must be HTTPS and at most 200 characters."
                    >
                      {({ id, describedBy, invalid }) => (
                        <Input
                          id={id}
                          aria-describedby={describedBy}
                          aria-invalid={invalid || undefined}
                          value={form.endpoint}
                          onChange={(event) =>
                            set("endpoint", event.target.value)
                          }
                          placeholder="https://agents.acme.dev/sentiment"
                          className="input--mono"
                          autoComplete="off"
                          spellCheck={false}
                        />
                      )}
                    </Field>
                  </div>

                  <Field
                    label="Agent public key"
                    error={errorText("agentPubkey", errors.agentPubkey)}
                    hint="Optional. Defaults to your connected wallet."
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        value={form.agentPubkey}
                        onChange={(event) =>
                          set("agentPubkey", event.target.value)
                        }
                        placeholder={
                          wallet.address ??
                          "Base58 address of the agent keypair"
                        }
                        className="input--mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </Field>

                  <Field
                    label="Metadata URI"
                    error={errorText("metadataUri", errors.metadataUri)}
                    hint="Optional. IPFS or HTTPS link to agent metadata."
                  >
                    {({ id, describedBy, invalid }) => (
                      <Input
                        id={id}
                        aria-describedby={describedBy}
                        aria-invalid={invalid || undefined}
                        value={form.metadataUri}
                        onChange={(event) =>
                          set("metadataUri", event.target.value)
                        }
                        placeholder="ipfs://…"
                        className="input--mono"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    )}
                  </Field>
                </div>
              </CardBody>
            </Card>
          </div>

          <aside className="workbench__aside">
            <Card>
              <CardHeader
                title="Cost"
                subtitle="Read from the on-chain registry config."
              />
              <CardBody>
                {configError ? (
                  <Alert tone="danger">{configError.message}</Alert>
                ) : !config ? (
                  <Alert tone="warning">
                    Registry config unavailable — costs cannot be shown and
                    registration is disabled.
                  </Alert>
                ) : (
                  <div style={{ display: "grid", gap: "var(--space-4)" }}>
                    <Stat
                      label="Registration fee"
                      value={formatSol(config.registrationFeeLamports)}
                      size="sm"
                      hint={`Paid to ${shortenAddress(config.treasury)}`}
                    />
                    <Stat
                      label="Network fee"
                      value="≈ 0.000005 SOL"
                      size="sm"
                      hint="Rent and signatures, paid by the wallet"
                    />

                    <Field
                      label="Stake"
                      required
                      error={
                        form.stakeSol.length > 0 && !stakeValid
                          ? "Enter a number, for example 0.1"
                          : stakeBelowMinimum
                            ? `Must be at least ${formatSol(minStake)}`
                            : undefined
                      }
                      hint={`Minimum ${formatSol(minStake)}, locked in the agent record.`}
                    >
                      {({ id, describedBy, invalid }) => (
                        <Input
                          id={id}
                          aria-describedby={describedBy}
                          aria-invalid={invalid || undefined}
                          value={form.stakeSol}
                          onChange={(event) =>
                            set("stakeSol", event.target.value)
                          }
                          placeholder={formatSol(minStake).replace(" SOL", "")}
                          inputMode="decimal"
                          suffix="SOL"
                          autoComplete="off"
                        />
                      )}
                    </Field>

                    <div
                      style={{
                        paddingTop: "var(--space-4)",
                        borderTop: "1px solid var(--color-border)",
                      }}
                    >
                      <Stat
                        label="Total to pay"
                        value={formatSol(totalCost)}
                        hint="Fee plus stake, plus network fee."
                      />
                    </div>
                  </div>
                )}
              </CardBody>
              <CardFooter>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  block
                  loading={tx.isBusy}
                  disabled={Boolean(blockedReason)}
                  disabledReason={blockedReason ?? undefined}
                >
                  {tx.isBusy ? "Confirming…" : "Register name"}
                </Button>
              </CardFooter>
            </Card>

            {nameHash ? (
              <Card variant="sunken">
                <CardBody tight>
                  <span className="stat__label">Name hash (SHA-256)</span>
                  <p
                    className="mono"
                    style={{
                      marginTop: "var(--space-2)",
                      fontSize: "var(--text-2xs)",
                      lineHeight: 1.5,
                      color: "var(--color-muted)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {nameHash}
                  </p>
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <Chip>Derived locally</Chip>
                    <Chip>Re-checked on chain</Chip>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {wallet.isConnected ? (
              <Card variant="sunken">
                <CardBody tight>
                  <span className="stat__label">Registering as</span>
                  <p
                    className="mono"
                    style={{ marginTop: 4, fontSize: "var(--text-sm)" }}
                  >
                    {shortenAddress(wallet.address ?? "")}
                  </p>
                  <div style={{ marginTop: "var(--space-3)" }}>
                    <Badge tone={activeCluster.isTestnet ? "lime" : "warning"}>
                      {activeCluster.label}
                    </Badge>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {tx.state.phase === "error" && tx.state.error ? (
              <Alert
                tone={tx.state.error.isUserRejection ? "info" : "danger"}
                title={tx.state.error.title}
              >
                {tx.state.error.message}
              </Alert>
            ) : null}
          </aside>
        </div>
      </form>
    </>
  );
}
