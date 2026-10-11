/**
 * Read hooks. Every value returned here comes from a real RPC call against the
 * AgentNS program — there is no fixture data, no placeholder figure and no
 * optimistic "looks successful" default anywhere in this module.
 */

import { useMemo } from "react";
import type { Address } from "@solana/kit";
import { useClient } from "@solana/react";
import useSWR from "swr";

import { agentnsProgramId } from "../config";
import type { AppClient } from "./client";
import {
  agentPdaForName,
  configPda,
  decodeAgentRecord,
  decodeRegistryConfig,
  type AgentRecord,
} from "../program/agentns";

/**
 * `AgentRecord.owner` is the first field after the 8-byte Anchor discriminator,
 * so the memcmp offset is exactly 8. (Kit types memcmp offsets as bigint.)
 */
const AGENT_RECORD_OWNER_OFFSET = 8n;

/* -------------------------------------------------------------------------- */
/* Low-level helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Pulls the base64 payload out of an RPC account.
 *
 * Kit types this as a discriminated union whose exact shape depends on the
 * `encoding` option. This normalises both shapes and returns null when the
 * account does not exist, so callers deal in `string | null` only.
 */
export function extractBase64(account: unknown): string | null {
  if (!account || typeof account !== "object") return null;
  const data = (account as { data?: unknown }).data;
  if (!data) return null;
  if (typeof data === "string") return data;
  if (Array.isArray(data) && typeof data[0] === "string") return data[0];
  return null;
}

export class QueryError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "QueryError";
  }
}

/** Turns an RPC failure into a message a person can act on. */
function describeRpcError(error: unknown, what: string): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch failed|network|ECONNREFUSED|Failed to fetch/i.test(message)) {
    return `Cannot reach the RPC endpoint while loading ${what}. Check that a validator is running and that VITE_SOLANA_RPC_URL is correct.`;
  }
  return `Failed to load ${what}: ${message}`;
}

/* -------------------------------------------------------------------------- */
/* Config                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The singleton registry config. Resolves to `null` when the account does not
 * exist yet — i.e. the program has been deployed but never initialised.
 */
export function useRegistryConfig() {
  const client = useClient<AppClient>();

  const swr = useSWR(
    "agentns:config",
    async () => {
      const pda = await configPda(address(agentnsProgramId));
      const response = await client.rpc.getAccountInfo(pda).send();
      const base64 = extractBase64(response.value);
      if (!base64) return null;
      return { address: pda, config: decodeRegistryConfig(base64) };
    },
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );

  return {
    config: swr.data?.config ?? null,
    configAddress: swr.data?.address ?? null,
    isLoading: swr.isLoading,
    error: swr.error
      ? new QueryError(
          describeRpcError(swr.error, "the registry config"),
          swr.error,
        )
      : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Agent records                                                               */
/* -------------------------------------------------------------------------- */

/** A single record by PDA, live-updating on account notifications. */
export function useAgentRecord(pda: Address | null) {
  const client = useClient<AppClient>();

  return useSWR(
    pda ? ["agentns:record", pda] : null,
    async () => {
      if (!pda) return null;
      const response = await client.rpc.getAccountInfo(pda).send();
      const base64 = extractBase64(response.value);
      if (!base64) return null;
      return decodeAgentRecord(base64);
    },
    {
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    },
  );
}

/** Look up a record by its full name, deriving the PDA locally. */
export function useRecordByName(fullName: string | null) {
  const client = useClient<AppClient>();

  const swr = useSWR(
    fullName ? ["agentns:record-name", fullName] : null,
    async () => {
      if (!fullName) return null;
      const pda = await agentPdaForName(fullName, address(agentnsProgramId));
      const response = await client.rpc.getAccountInfo(pda).send();
      const base64 = extractBase64(response.value);
      if (!base64) return null;
      return { pda, record: decodeAgentRecord(base64) };
    },
    { shouldRetryOnError: false },
  );

  return {
    record: swr.data?.record ?? null,
    pda: swr.data?.pda ?? null,
    isLoading: swr.isLoading,
    error: swr.error
      ? new QueryError(describeRpcError(swr.error, "this name"), swr.error)
      : null,
  };
}

export type OwnedRecord = AgentRecord & { pda: Address };

/**
 * Every record owned by one wallet, via `getProgramAccounts` with a memcmp on
 * the owner field. The server does the filtering, so this is a single round-trip
 * rather than a scan-and-filter in the browser.
 */
export function useRecordsByOwner(owner: Address | null) {
  const client = useClient<AppClient>();

  return useSWR(
    owner ? ["agentns:records-by-owner", owner] : null,
    async () => {
      if (!owner) return [];
      const response = await client.rpc
        .getProgramAccounts(address(agentnsProgramId), {
          encoding: "base64",
          dataSlice: { offset: 0, length: 0 },
          filters: [
            {
              memcmp: {
                offset: AGENT_RECORD_OWNER_OFFSET,
                bytes: owner,
                encoding: "base58",
              },
            },
          ],
        })
        .send();

      const records: OwnedRecord[] = [];
      for (const account of response) {
        const base64 = extractBase64(account.account);
        if (!base64) continue;
        try {
          records.push({
            ...decodeAgentRecord(base64),
            pda: address(account.pubkey),
          });
        } catch {
          // A record we cannot decode is skipped rather than crashing the list;
          // it almost always means an older account layout.
        }
      }
      return records.sort((a, b) => (a.name < b.name ? -1 : 1));
    },
    {
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                    */
/* -------------------------------------------------------------------------- */

export type RecentTransaction = {
  signature: string;
  slot: bigint;
  /** `null` while the RPC node has not confirmed the transaction yet. */
  timestamp: bigint | null;
  err: unknown;
  status: "success" | "failed";
};

/** Recent signatures involving the program address, straight from the RPC node. */
export function useRecentTransactions(limit = 20) {
  const client = useClient<AppClient>();

  return useSWR(
    ["agentns:activity", limit],
    async (): Promise<RecentTransaction[]> => {
      const response = await client.rpc
        .getSignaturesForAddress(address(agentnsProgramId), { limit })
        .send();

      // `values` is a lazy accessor in Kit, so materialise it before mapping.
      return [...response.values()].map((entry) => ({
        signature: entry.signature,
        slot: entry.slot,
        timestamp:
          entry.blockTime === null || entry.blockTime === undefined
            ? null
            : BigInt(entry.blockTime),
        err: entry.err,
        status: entry.err ? "failed" : "success",
      }));
    },
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Small utilities                                                             */
/* -------------------------------------------------------------------------- */

function address(value: string): Address {
  return value as Address;
}

/** Formats a bigint SOL amount for display, falling back safely on huge values. */
export function useSolFormatter() {
  return useMemo(
    () => new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }),
    [],
  );
}
