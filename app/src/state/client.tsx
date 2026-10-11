import { useMemo, type ReactNode } from "react";
import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";
import { ClientProvider } from "@solana/react";

import { activeCluster } from "../config";

/**
 * One client for the whole app. The connected wallet supplies the payer and the
 * identity; `solanaRpc` adds the connection, subscriptions and the transaction
 * planner/executor that back `client.sendTransaction`.
 *
 * Order matters: `walletSigner` must come before `solanaRpc`, because the RPC
 * plugin requires a payer to already be installed.
 */
const client = createClient()
  .use(walletSigner({ chain: activeCluster.chain }))
  .use(
    solanaRpc({
      rpcUrl: activeCluster.rpcUrl,
      rpcSubscriptionsUrl: activeCluster.wsUrl,
    }),
  );

/** Exported so every `useClient<AppClient>()` call in the app stays typed. */
export type AppClient = Awaited<typeof client>;

export function Providers({ children }: { children: ReactNode }) {
  // `client` is module-level and stable, so this memo never changes identity.
  const value = useMemo(() => client, []);
  return <ClientProvider client={value}>{children}</ClientProvider>;
}
