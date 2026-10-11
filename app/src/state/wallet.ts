import {
  useConnectedWallet,
  useWalletStatus,
} from "@solana/kit-plugin-wallet/react";
import { useClient } from "@solana/react";
import type { Address } from "@solana/kit";

import type { AppClient } from "./client";

/**
 * One place to read wallet state from, so every screen agrees on what
 * "connected" means and no screen re-subscribes on its own.
 */
export function useWallet() {
  const client = useClient<AppClient>();
  const connected = useConnectedWallet(client);
  const status = useWalletStatus(client);

  return {
    /** `null` until the wallet is connected. */
    address: (connected?.account.address as Address | undefined) ?? null,
    walletName: connected?.wallet.name ?? null,
    /** `true` for signing-capable wallets; `false` for watch-only ones. */
    canSign: Boolean(connected?.signer),
    status,
    isConnected: status === "connected",
    /** True while a connect/disconnect round-trip is in flight. */
    isConnecting:
      status === "connecting" ||
      status === "reconnecting" ||
      status === "disconnecting",
    isPending: status === "pending",
  };
}
