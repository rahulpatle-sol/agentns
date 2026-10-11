import { useCallback, useRef, useState } from "react";
import type { Instruction } from "@solana/instructions";
import { useClient } from "@solana/react";

import { explorerTxUrl } from "../../config";
import type { AppClient } from "../client";
import { useToast } from "../../components/ui/Toast";
import { useWallet } from "../wallet";
import { describeTransactionError, type TransactionFailure } from "./errors";

export type TxPhase =
  | "idle"
  /** Waiting for the user to approve in their wallet. */
  | "signing"
  /** Submitted; waiting for the network to include it. */
  | "submitting"
  /** Included; waiting for confirmation. */
  | "confirming"
  | "success"
  | "error";

export type TxState = {
  phase: TxPhase;
  signature: string | null;
  error: TransactionFailure | null;
};

const IDLE: TxState = { phase: "idle", signature: null, error: null };

export type SendOptions = {
  /** Toast title while pending, e.g. "Registering mcp://…". */
  pendingTitle: string;
  successTitle: string;
  /** Noun for the action, used in error copy. */
  action: string;
  /** Runs after a confirmed transaction, e.g. to revalidate a list. */
  onConfirmed?: () => void;
};

/**
 * Drives the full transaction lifecycle for one AgentNS instruction.
 *
 * Guarantees the UX rules the design calls for:
 *   - only one transaction can be in flight per hook instance (the button is
 *     disabled, so a double-click cannot submit twice);
 *   - the signature is surfaced the moment the RPC accepts it;
 *   - a declined signature is reported as a cancellation, not a failure;
 *   - a success toast is only shown after the network confirms the transaction.
 *   Nothing here ever reports success optimistically.
 */
export function useTransaction() {
  const client = useClient<AppClient>();
  const wallet = useWallet();
  const toast = useToast();

  const [state, setState] = useState<TxState>(IDLE);
  const inFlight = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    inFlight.current = false;
    setState(IDLE);
  }, []);

  const send = useCallback(
    async (
      instruction: Instruction,
      options: SendOptions,
    ): Promise<string | null> => {
      // Guard against a second submission while one is still running.
      if (inFlight.current) return null;

      if (!wallet.address) {
        setState({
          phase: "error",
          signature: null,
          error: {
            title: "No wallet connected",
            message: "Connect a wallet before signing a transaction.",
            isUserRejection: false,
            isProgramError: false,
          },
        });
        return null;
      }

      inFlight.current = true;
      const controller = new AbortController();
      abortRef.current = controller;

      const toastId = toast.push({
        tone: "pending",
        title: options.pendingTitle,
        message: "Waiting for you to approve in your wallet…",
        duration: 0,
      });

      setState({ phase: "signing", signature: null, error: null });

      try {
        const result = await client.sendTransaction([instruction], {
          abortSignal: controller.signal,
        });
        const signature = result.context.signature;

        // Tell the user the signature the moment it exists, then wait for the
        // network to confirm it before claiming success.
        toast.update(toastId, {
          tone: "pending",
          title: options.pendingTitle,
          message: `Submitted as ${signature.slice(0, 8)}… — waiting for confirmation.`,
          duration: 0,
        });
        setState({ phase: "confirming", signature, error: null });

        await client.rpc
          .getTransaction(signature, {
            encoding: "json",
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          })
          .send();

        toast.update(toastId, {
          tone: "success",
          title: options.successTitle,
          message: `Confirmed · ${signature.slice(0, 8)}…`,
          duration: 6000,
        });

        setState({ phase: "success", signature, error: null });
        options.onConfirmed?.();
        return signature;
      } catch (error) {
        const failure = describeTransactionError(error, options.action);

        toast.update(toastId, {
          tone: failure.isUserRejection ? "info" : "error",
          title: failure.title,
          message: failure.signature
            ? `${failure.message} (${explorerTxUrl(failure.signature)})`
            : failure.message,
          duration: 10000,
        });

        setState({
          phase: "error",
          signature: failure.signature ?? null,
          error: failure,
        });
        return null;
      } finally {
        inFlight.current = false;
        abortRef.current = null;
      }
    },
    [client, wallet.address, toast],
  );

  return {
    state,
    send,
    reset,
    /** True while the transaction is anywhere between signing and confirming. */
    isBusy:
      state.phase === "signing" ||
      state.phase === "submitting" ||
      state.phase === "confirming",
  };
}

/** Human label for each phase, used for button text and status rows. */
export const PHASE_LABEL: Record<TxPhase, string> = {
  idle: "Ready",
  signing: "Approve in wallet",
  submitting: "Submitting",
  confirming: "Confirming",
  success: "Confirmed",
  error: "Failed",
};
